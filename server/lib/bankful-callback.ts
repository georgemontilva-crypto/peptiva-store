import crypto from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { verifySignature } from "./bankful";
import { logOrderEvent, markOrderPaid } from "./orders";

/**
 * Bankful a veces agrega sus parámetros con "?" en lugar de "&" (kind=complete?REQUEST_ACTION=...).
 * Se reconstruye la query string para leerlos bien.
 */
function readParams(req: Request): Record<string, string> {
  const rawQuery = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?") + 1) : "";
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawQuery.replace(/\?/g, "&"))) params[k] = v;
  const body = (req.body ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(body)) if (typeof v === "string" || typeof v === "number") params[k] = String(v);
  return params;
}

const sameKey = (a: string | undefined, b: string) => {
  const x = Buffer.from(a ?? "");
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Vuelta del cliente desde Bankful (GET) y aviso de servidor a servidor (POST).
 *
 * Quién puede cambiar el estado de un pedido:
 *  - Una respuesta FIRMADA por Bankful. El resultado se lee de TRANS_STATUS_NAME, que va dentro de la
 *    firma. El parámetro `kind` de nuestra propia URL no está firmado y cualquiera puede cambiarlo en
 *    la barra de direcciones, así que nunca decide si un pedido está pagado.
 *  - Sin firma, solo quien trae la clave del pedido (el propio cliente) y solo para lo que no le da
 *    nada gratis: cancelar o marcar como fallido un pedido que sigue sin pagar. Si vuelve diciendo que
 *    pagó pero sin firma, el pedido queda en revisión manual, nunca como pagado.
 */
export async function handleBankfulCallback(req: Request, res: Response) {
  const params = readParams(req);
  const signatureValid = verifySignature(params);
  // Con firma válida manda el pedido que firmó Bankful; el de nuestra URL solo vale sin firma
  const orderId = Number((signatureValid ? params.XTL_ORDER_ID : params.XTL_ORDER_ID || params.xtl_order_id || params.orderId) || 0);
  const kind = (params.kind ?? "").toLowerCase();
  const transStatus = (params.TRANS_STATUS_NAME ?? "").toUpperCase();
  const transactionId = params.TRANS_ORDER_ID || null;
  const isBrowser = req.method === "GET" || (req.headers.accept ?? "").includes("text/html");

  const [order] = Number.isInteger(orderId) && orderId > 0 ? await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)) : [];

  const finish = async (outcome: string, redirectTo: string) => {
    await db.insert(schema.paymentEvents).values({
      orderId: order?.id ?? null, kind: kind || null, transStatus: transStatus || null, transactionId,
      signatureValid, outcome, payload: params,
    });
    if (isBrowser) return res.redirect(303, redirectTo);
    return res.status(200).send("OK");
  };

  if (!order) {
    console.warn(`[bankful] callback sin pedido válido (orderId=${params.XTL_ORDER_ID || params.orderId || "?"})`);
    return finish("order_not_found", "/checkout");
  }

  const receipt = `/order-received/${order.id}?key=${encodeURIComponent(order.accessKey)}`;

  if (!signatureValid) {
    // Sin firma y sin la clave del pedido no se toca nada
    if (!sameKey(params.key, order.accessKey)) return finish("unsigned_ignored", "/checkout");

    if (kind === "cancel") {
      if (order.status === "pending") {
        await db.update(schema.orders).set({ status: "cancelled" }).where(eq(schema.orders.id, order.id));
        await logOrderEvent(order.id, "cancelled", "Payment cancelled by customer");
      }
      return finish("cancelled", "/checkout?payment=cancelled");
    }
    if (kind === "failed") {
      if (order.status === "pending") {
        await db.update(schema.orders).set({ status: "failed" }).where(eq(schema.orders.id, order.id));
        await logOrderEvent(order.id, "failed", "Payment not completed");
      }
      return finish("failed_unsigned", "/checkout?payment=failed");
    }
    if (kind === "complete" || kind === "pending" || transStatus) {
      if (order.status === "pending") {
        await db.update(schema.orders).set({ status: "on_hold" }).where(eq(schema.orders.id, order.id));
        await logOrderEvent(order.id, "on_hold", "Payment signature could not be verified; manual review", { public: false });
      }
      console.error(`[bankful] respuesta sin firma válida para el pedido ${order.id} (kind=${kind}, status=${transStatus}). Queda en revisión.`);
      return finish("signature_invalid_on_hold", receipt);
    }
    return finish("ignored", receipt);
  }

  // A partir de aquí la respuesta está firmada por Bankful: el estado firmado es el que cuenta
  if (transStatus === "APPROVED") {
    const paidValue = params.TRANS_VALUE ? Number(params.TRANS_VALUE) : null;
    if (paidValue != null && Math.abs(paidValue - Number(order.total)) > 0.01) {
      if (order.status === "pending" || order.status === "failed" || order.status === "cancelled") {
        await db.update(schema.orders).set({ status: "on_hold", paymentTransactionId: transactionId }).where(eq(schema.orders.id, order.id));
        await logOrderEvent(order.id, "on_hold", `Charged amount ${paidValue} differs from order total`, { public: false });
      }
      console.error(`[bankful] monto distinto en pedido ${order.id}: cobrado ${paidValue}, total ${order.total}`);
      return finish("amount_mismatch_on_hold", receipt);
    }
    const changed = await markOrderPaid(order.id, transactionId);
    return finish(changed ? "paid" : "already_processed", receipt);
  }

  if (["DECLINED", "FAILED", "ERROR"].includes(transStatus)) {
    if (order.status === "pending" || order.status === "on_hold") {
      await db.update(schema.orders).set({ status: "failed" }).where(eq(schema.orders.id, order.id));
      await logOrderEvent(order.id, "failed", "Payment declined");
    }
    return finish("failed", "/checkout?payment=failed");
  }

  if (transStatus === "PENDING") {
    if (order.status === "pending") {
      await db.update(schema.orders).set({ status: "on_hold", paymentTransactionId: transactionId }).where(eq(schema.orders.id, order.id));
      await logOrderEvent(order.id, "on_hold", "Payment pending confirmation");
    }
    return finish("pending_on_hold", receipt);
  }

  if (kind === "cancel") {
    if (order.status === "pending") {
      await db.update(schema.orders).set({ status: "cancelled" }).where(eq(schema.orders.id, order.id));
      await logOrderEvent(order.id, "cancelled", "Payment cancelled by customer");
    }
    return finish("cancelled", "/checkout?payment=cancelled");
  }

  return finish("ignored", receipt);
}
