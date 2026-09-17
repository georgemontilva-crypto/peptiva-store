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

export async function handleBankfulCallback(req: Request, res: Response) {
  const params = readParams(req);
  const orderId = Number(params.XTL_ORDER_ID || params.xtl_order_id || params.orderId || 0);
  const kind = (params.kind ?? "").toLowerCase();
  const transStatus = (params.TRANS_STATUS_NAME ?? "").toUpperCase();
  const transactionId = params.TRANS_ORDER_ID || null;
  const isBrowser = req.method === "GET" || (req.headers.accept ?? "").includes("text/html");

  const [order] = orderId ? await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)) : [];
  const signatureValid = verifySignature(params);

  const finish = async (outcome: string, redirectTo: string) => {
    await db.insert(schema.paymentEvents).values({
      orderId: order?.id ?? null, kind: kind || null, transStatus: transStatus || null, transactionId,
      signatureValid, outcome, payload: params,
    });
    if (isBrowser) return res.redirect(303, redirectTo);
    return res.status(200).send("OK");
  };

  if (!order) {
    console.warn(`[bankful] callback sin pedido válido (orderId=${orderId})`);
    return finish("order_not_found", "/checkout");
  }

  const receipt = `/order-received/${order.id}?key=${encodeURIComponent(order.accessKey)}`;
  const isApproved = kind === "complete" || transStatus === "APPROVED";
  const isFailed = kind === "failed" || ["DECLINED", "FAILED", "ERROR"].includes(transStatus);
  const isStateChange = isApproved || isFailed || kind === "cancel" || kind === "pending";

  // Solo una llamada firmada por Bankful puede cambiar el estado del pago
  if (isStateChange && !signatureValid) {
    if (order.status === "pending") {
      await db.update(schema.orders).set({ status: "on_hold" }).where(eq(schema.orders.id, order.id));
      await logOrderEvent(order.id, "on_hold", "Payment signature could not be verified; manual review", { public: false });
    }
    console.error(`[bankful] firma inválida para pedido ${order.id} (kind=${kind}, status=${transStatus}). Queda en revisión.`);
    return finish("signature_invalid_on_hold", receipt);
  }

  if (isApproved) {
    const paidValue = params.TRANS_VALUE ? Number(params.TRANS_VALUE) : null;
    if (paidValue != null && Math.abs(paidValue - Number(order.total)) > 0.01) {
      await db.update(schema.orders).set({ status: "on_hold", paymentTransactionId: transactionId }).where(eq(schema.orders.id, order.id));
      await logOrderEvent(order.id, "on_hold", `Charged amount ${paidValue} differs from order total`, { public: false });
      console.error(`[bankful] monto distinto en pedido ${order.id}: cobrado ${paidValue}, total ${order.total}`);
      return finish("amount_mismatch_on_hold", receipt);
    }
    const changed = await markOrderPaid(order.id, transactionId);
    return finish(changed ? "paid" : "already_processed", receipt);
  }

  if (kind === "cancel") {
    if (order.status === "pending") {
      await db.update(schema.orders).set({ status: "cancelled" }).where(eq(schema.orders.id, order.id));
      await logOrderEvent(order.id, "cancelled", "Payment cancelled by customer");
    }
    return finish("cancelled", "/checkout?payment=cancelled");
  }

  if (isFailed) {
    if (order.status === "pending" || order.status === "on_hold") {
      await db.update(schema.orders).set({ status: "failed" }).where(eq(schema.orders.id, order.id));
      await logOrderEvent(order.id, "failed", "Payment declined");
    }
    return finish("failed", "/checkout?payment=failed");
  }

  if (kind === "pending") {
    if (order.status === "pending") {
      await db.update(schema.orders).set({ status: "on_hold" }).where(eq(schema.orders.id, order.id));
      await logOrderEvent(order.id, "on_hold", "Payment pending confirmation");
    }
    return finish("pending_on_hold", receipt);
  }

  return finish("ignored", receipt);
}
