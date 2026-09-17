import crypto from "node:crypto";

/**
 * Integración con la Hosted Payment Page de Bankful.
 * Portado del plugin de WooCommerce (bankful-payment-gateway-fixed v2.0.1).
 */

export const bankfulConfigured = () => Boolean(process.env.BANKFUL_API_USERNAME && process.env.BANKFUL_API_PASSWORD);

const hostedPageUrl = () =>
  process.env.BANKFUL_HOSTED_PAGE_URL || "https://api.paybybankful.com/front-calls/go-in/hosted-page-pay";

/** HMAC-SHA256 con la contraseña de la API sobre claves ordenadas concatenadas como KEY+VALUE. */
export function computeSignature(fields: Record<string, string>): string {
  const payload = Object.keys(fields)
    .filter((k) => k.toLowerCase() !== "signature" && fields[k] !== "" && fields[k] != null)
    .sort()
    .map((k) => k + fields[k])
    .join("");
  return crypto.createHmac("sha256", (process.env.BANKFUL_API_PASSWORD ?? "").trim()).update(payload).digest("hex");
}

/** Campos de respuesta que Bankful incluye en su firma. Los parámetros propios de nuestra URL no se firman. */
const SIGNED_FIELDS = [
  "REQUEST_ACTION", "TRANS_STATUS_NAME", "TRANS_VALUE", "TRANS_REQUEST_ID", "TRANS_ORDER_ID", "TRANS_RECORD_ID",
  "XTL_ORDER_ID", "TRANS_CUR", "TIMESTAMP", "API_ADVICE", "SERVICE_ADVICE", "PROCESSOR_ADVICE", "ERROR_MESSAGE",
] as const;

export function verifySignature(params: Record<string, string>): boolean {
  const incoming = params.SIGNATURE;
  if (!incoming) return false;
  const signed: Record<string, string> = {};
  for (const key of SIGNED_FIELDS) if (params[key]) signed[key] = String(params[key]);
  if (!Object.keys(signed).length) return false;
  const expected = computeSignature(signed);
  const a = Buffer.from(expected.toLowerCase());
  const b = Buffer.from(String(incoming).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const trunc = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max));
const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "") || "0000000000";

type OrderForPayment = {
  id: number;
  accessKey: string;
  total: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
};

function extractRedirect(body: string): string | null {
  const text = body.trim();
  if (/^https?:\/\//.test(text)) return text.split(/[\r\n]+/)[0]!.replace(/^"|"$/g, "");
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    for (const key of ["redirect_url", "redirectUrl", "url", "redirect"]) {
      const v = json[key];
      if (typeof v === "string" && v.startsWith("http")) return v;
    }
  } catch {
    /* no es JSON */
  }
  return null;
}

/** Crea la sesión de pago y devuelve la URL de Bankful a la que hay que enviar al cliente. */
export async function createHostedPayment(order: OrderForPayment, baseUrl: string): Promise<string> {
  const cb = (kind: string) =>
    `${baseUrl}/wc-api/bankful_callback?orderId=${order.id}&key=${encodeURIComponent(order.accessKey)}&kind=${kind}`;

  const fields: Record<string, string> = {
    req_username: (process.env.BANKFUL_API_USERNAME ?? "").trim(),
    transaction_type: "CAPTURE",
    amount: Number(order.total).toFixed(2),
    request_currency: "USD",
    cust_email: order.email.trim(),
    cust_fname: trunc(order.firstName.trim(), 80),
    cust_lname: trunc(order.lastName.trim(), 80),
    cust_phone: digits(order.phone),
    bill_addr: trunc(order.address1 || "N/A", 200),
    bill_addr_city: trunc(order.city || "N/A", 100),
    bill_addr_state: order.state.slice(0, 2).toUpperCase(),
    bill_addr_zip: trunc(order.zip || "00000", 20),
    bill_addr_country: order.country || "US",
    xtl_order_id: String(order.id),
    cart_name: "Hosted-Page",
    url_cancel: cb("cancel"),
    url_complete: cb("complete"),
    url_failed: cb("failed"),
    url_pending: cb("pending"),
    url_callback: `${baseUrl}/wc-api/bankful_callback`,
    return_redirect_url: "Y",
  };
  if (order.address2) fields.bill_addr_2 = trunc(order.address2.trim(), 200);
  fields.signature = computeSignature(fields);

  const headers = { Accept: "*/*", "User-Agent": "Peptiva-Checkout/3.0", "Cache-Control": "no-cache" };
  const attempts: RequestInit[] = [
    { headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields).toString() },
    { headers: { ...headers, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(fields) },
  ];

  let lastBody = "";
  for (const init of attempts) {
    try {
      const res = await fetch(hostedPageUrl(), { method: "POST", signal: AbortSignal.timeout(30_000), ...init });
      lastBody = await res.text();
      const redirect = extractRedirect(lastBody);
      if (redirect) return redirect;
    } catch (err) {
      lastBody = err instanceof Error ? err.message : String(err);
    }
  }

  let message = lastBody.slice(0, 300);
  try {
    const json = JSON.parse(lastBody) as Record<string, string>;
    message = json.errorMessage ?? json.message ?? json.error ?? message;
  } catch {
    /* texto plano */
  }
  console.error(`[bankful] no se obtuvo URL de pago para el pedido ${order.id}: ${message}`);
  throw new Error("The payment page could not be opened. Please try again in a moment.");
}
