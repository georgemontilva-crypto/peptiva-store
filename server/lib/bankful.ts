import crypto from "node:crypto";

/**
 * Integración con la Hosted Payment Page (HPP) de Bankful.
 *
 * El servidor pide a Bankful una sesión de pago firmada y recibe una URL; el cliente paga en la página
 * de Bankful y vuelve a la tienda. La tienda nunca ve ni guarda datos de tarjeta.
 *
 * Sigue la "HPP Integration Guide" (rev. 1.0, marzo 2026): POST en JSON, todos los valores como texto,
 * firma HMAC-SHA256 con la contraseña de la API. De sandbox a producción solo cambian tres valores de
 * configuración (usuario, contraseña y URL), no el código.
 */

const LIVE_URL = "https://api.paybybankful.com/front-calls/go-in/hosted-page-pay";
const SANDBOX_URL = "https://api-dev1.bankfulportal.com/front-calls/go-in/hosted-page-pay";

const truthy = (v?: string) => /^(1|true|yes|on)$/i.test((v ?? "").trim());
const username = () => (process.env.BANKFUL_API_USERNAME ?? "").trim();
const password = () => (process.env.BANKFUL_API_PASSWORD ?? "").trim();

export const bankfulConfigured = () => Boolean(username() && password());

/** BANKFUL_HOSTED_PAGE_URL manda si está; si no, BANKFUL_SANDBOX=true elige el entorno de pruebas. */
const hostedPageUrl = () => process.env.BANKFUL_HOSTED_PAGE_URL?.trim() || (truthy(process.env.BANKFUL_SANDBOX) ? SANDBOX_URL : LIVE_URL);

/** "sandbox" es cualquier destino que no sea el de producción: ahí no se cobra dinero real. */
export function bankfulMode(): "off" | "sandbox" | "live" {
  if (!bankfulConfigured()) return "off";
  return hostedPageUrl() === LIVE_URL ? "live" : "sandbox";
}

/** HMAC-SHA256 con la contraseña de la API sobre las claves ordenadas, concatenadas como clave+valor. */
export function computeSignature(fields: Record<string, string>): string {
  const payload = Object.keys(fields)
    .filter((k) => k.toLowerCase() !== "signature" && fields[k] !== "" && fields[k] != null)
    .sort()
    .map((k) => k + fields[k])
    .join("");
  return crypto.createHmac("sha256", password()).update(payload).digest("hex");
}

/** Campos de respuesta que Bankful incluye en su firma. Los parámetros propios de nuestra URL no se firman. */
const SIGNED_FIELDS = [
  "REQUEST_ACTION", "TRANS_STATUS_NAME", "TRANS_VALUE", "TRANS_REQUEST_ID", "TRANS_ORDER_ID", "TRANS_RECORD_ID",
  "XTL_ORDER_ID", "TRANS_CUR", "TIMESTAMP", "API_ADVICE", "SERVICE_ADVICE", "PROCESSOR_ADVICE", "ERROR_MESSAGE",
  "CUSTOMER_VAULT_ID",
] as const;

export function verifySignature(params: Record<string, string>): boolean {
  const incoming = params.SIGNATURE;
  if (!incoming || !bankfulConfigured()) return false;
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
  id: number | string;
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

/** Cuerpo de la petición tal como lo pide la guía: todos los valores son texto y va firmado. */
function buildFields(order: OrderForPayment, baseUrl: string): Record<string, string> {
  const cb = (kind: string) =>
    `${baseUrl}/wc-api/bankful_callback?orderId=${order.id}&key=${encodeURIComponent(order.accessKey)}&kind=${kind}`;

  const fields: Record<string, string> = {
    req_username: username(),
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
  if (order.address2?.trim()) fields.bill_addr_2 = trunc(order.address2.trim(), 200);
  fields.signature = computeSignature(fields);
  return fields;
}

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

function errorText(body: string): string {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const msg = json.errorMessage ?? json.message ?? json.error;
    if (typeof msg === "string" && msg) return msg;
    if (msg) return JSON.stringify(msg).slice(0, 300);
  } catch {
    /* texto plano */
  }
  return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

type HostedResult = { ok: true; url: string } | { ok: false; status: number; message: string };

/**
 * Pide la sesión de pago. Se envía en JSON, como indica la guía; si Bankful no lo acepta por formato,
 * se repite como formulario (lo que usaba el plugin de WooCommerce). Un 401 no se reintenta: es firma
 * o credenciales, y cambiar el formato no lo arregla.
 */
async function requestHostedPage(fields: Record<string, string>): Promise<HostedResult> {
  const headers = { "User-Agent": "Peptiva-Checkout/3.1", "Cache-Control": "no-cache" };
  const attempts: RequestInit[] = [
    { headers: { ...headers, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(fields) },
    { headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded", Accept: "*/*" }, body: new URLSearchParams(fields).toString() },
  ];

  let last: { status: number; message: string } = { status: 0, message: "No response from Bankful." };
  for (const init of attempts) {
    try {
      const res = await fetch(hostedPageUrl(), { method: "POST", signal: AbortSignal.timeout(20_000), ...init });
      const body = await res.text();
      const url = extractRedirect(body);
      if (url) return { ok: true, url };
      last = { status: res.status, message: errorText(body) || `HTTP ${res.status}` };
      if (res.status === 401 || /signature/i.test(last.message)) break;
    } catch (err) {
      last = { status: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }
  return { ok: false, ...last };
}

/** Crea la sesión de pago y devuelve la URL de Bankful a la que hay que enviar al cliente. */
export async function createHostedPayment(order: OrderForPayment, baseUrl: string): Promise<string> {
  const result = await requestHostedPage(buildFields(order, baseUrl));
  if (result.ok) return result.url;
  console.error(`[bankful] no se obtuvo URL de pago para el pedido ${order.id} (${bankfulMode()}, HTTP ${result.status}): ${result.message}`);
  throw new Error("The payment page could not be opened. Please try again in a moment.");
}

/**
 * Prueba de conexión para el admin: pide a Bankful una sesión de pago de 1.00 con datos de ejemplo.
 * No cobra nada (solo se cobra si alguien abre esa página y paga) y confirma de una vez que usuario,
 * contraseña, firma y URL son correctos. La URL de pago solo se devuelve en sandbox, para poder hacer
 * un pago de prueba; en producción no, porque pagarla sería un cargo real sin pedido.
 */
export async function testBankfulConnection(baseUrl: string) {
  const mode = bankfulMode();
  if (mode === "off") return { ok: false as const, mode, status: 0, message: "BANKFUL_API_USERNAME and BANKFUL_API_PASSWORD are not set.", hint: null, url: null };

  const result = await requestHostedPage(
    buildFields(
      {
        id: `TEST-${Date.now()}`, accessKey: "test", total: "1.00", email: "test@peptivasupplies.com", firstName: "Test", lastName: "Connection",
        phone: "9999212345", address1: "123 Road", address2: null, city: "Los Angeles", state: "CA", zip: "90044", country: "US",
      },
      baseUrl,
    ),
  );
  if (result.ok) return { ok: true as const, mode, status: 201, message: "Bankful accepted the credentials and returned a payment page.", hint: null, url: mode === "sandbox" ? result.url : null };

  const rejected = result.status === 401 || /signature|credential|unauthori/i.test(result.message);
  const hint = rejected
    ? mode === "live"
      ? "Bankful rejected the username or password. If these are the sandbox credentials, add BANKFUL_SANDBOX=true; live credentials only work without it."
      : "Bankful's test environment rejected the username or password. Check both are copied exactly, with no spaces. If these are the live credentials, remove BANKFUL_SANDBOX."
    : result.status === 0
      ? "The store could not reach Bankful. Try again in a minute."
      : null;
  return { ok: false as const, mode, status: result.status, message: result.message, hint, url: null };
}
