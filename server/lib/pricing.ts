import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { mediaUrl } from "./media";

export type CartLineInput = { productId: number; variantId: number | null; quantity: number };

/** Descuento por cantidad de la misma línea (igual que en WooCommerce): 2 uds = 10%, 3+ = 15%. */
export const BUNDLE_TIERS = [
  { minQty: 3, percent: 15 },
  { minQty: 2, percent: 10 },
] as const;

export const bundlePercentFor = (qty: number) => BUNDLE_TIERS.find((t) => qty >= t.minQty)?.percent ?? 0;

const cents = (v: string | number) => Math.round(Number(v) * 100);
const toMoney = (c: number) => (c / 100).toFixed(2);

export type Quote = Awaited<ReturnType<typeof quoteCart>>;

/**
 * Calcula el carrito con precios de la base de datos (nunca confía en precios del cliente).
 * Orden: precio de lista → descuento por cantidad por línea → cupón sobre el total con descuento.
 */
export async function quoteCart(lines: CartLineInput[], couponCode?: string | null, opts: { email?: string | null } = {}) {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = productIds.length
    ? await db
        .select()
        .from(schema.products)
        .where(and(inArray(schema.products.id, productIds), eq(schema.products.status, "active")))
    : [];
  const variants = productIds.length
    ? await db.select().from(schema.productVariants).where(inArray(schema.productVariants.productId, productIds))
    : [];

  const priced = [];
  const removed: CartLineInput[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    const productVariants = variants.filter((v) => v.productId === line.productId);
    const variant = line.variantId != null ? productVariants.find((v) => v.id === line.variantId) : undefined;
    // Producto inexistente, variante inválida o falta elegir variante → se descarta
    if (!product || (productVariants.length > 0 && !variant) || (productVariants.length === 0 && line.variantId != null)) {
      removed.push(line);
      continue;
    }
    const quantity = Math.max(1, Math.min(99, Math.floor(line.quantity)));
    const unit = cents(variant?.salePrice ?? variant?.price ?? product.salePrice ?? product.price);
    const bundlePercent = bundlePercentFor(quantity);
    const gross = unit * quantity;
    const lineTotal = Math.round(gross * (1 - bundlePercent / 100));
    priced.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      slug: product.slug,
      name: product.name,
      variantLabel: variant?.label ?? null,
      imageUrl: mediaUrl(product.imageUrl),
      unitPrice: toMoney(unit),
      quantity,
      bundlePercent,
      gross,
      lineTotal,
    });
  }

  const subtotalCents = priced.reduce((s, l) => s + l.gross, 0);
  const afterBundle = priced.reduce((s, l) => s + l.lineTotal, 0);

  let couponDiscountCents = 0;
  let coupon: { code: string; label: string; affiliateId: number | null } | null = null;
  let couponError: string | null = null;
  const code = couponCode?.trim().toLowerCase();
  if (code) {
    const [c] = await db.select().from(schema.coupons).where(eq(schema.coupons.code, code));
    const now = Date.now();
    if (!c || !c.active) couponError = "This discount code is not valid.";
    else if (c.startsAt && c.startsAt.getTime() > now) couponError = "This discount code is not active yet.";
    else if (c.expiresAt && c.expiresAt.getTime() < now) couponError = "This discount code has expired.";
    else if (c.usageLimit != null && c.usageCount >= c.usageLimit) couponError = "This discount code has reached its usage limit.";
    else if (c.minSubtotal != null && afterBundle < cents(c.minSubtotal)) {
      couponError = `This code requires a minimum order of $${Number(c.minSubtotal).toFixed(2)}.`;
    } else {
      if (c.perCustomerLimit != null && opts.email) {
        const [used] = await db
          .select({ n: count() })
          .from(schema.orders)
          .where(
            and(
              eq(schema.orders.couponCode, c.code),
              eq(schema.orders.email, opts.email.trim().toLowerCase()),
              sql`${schema.orders.status} IN ('paid','on_hold','shipped','completed')`,
            ),
          );
        if ((used?.n ?? 0) >= c.perCustomerLimit) couponError = "You've already used this discount code.";
      }
      if (!couponError) {
        couponDiscountCents =
          c.type === "percent" ? Math.round((afterBundle * Number(c.amount)) / 100) : Math.min(afterBundle, cents(c.amount));
        coupon = { code: c.code, label: c.type === "percent" ? `${Number(c.amount)}% off` : `$${Number(c.amount)} off`, affiliateId: c.affiliateId };
      }
    }
  }

  const shippingCents = 0;
  const totalCents = Math.max(0, afterBundle - couponDiscountCents + shippingCents);

  return {
    lines: priced.map(({ gross, lineTotal, ...l }) => ({ ...l, lineSubtotal: toMoney(gross), lineTotal: toMoney(lineTotal) })),
    removed,
    subtotal: toMoney(subtotalCents),
    bundleDiscount: toMoney(subtotalCents - afterBundle),
    coupon,
    couponError,
    couponDiscount: toMoney(couponDiscountCents),
    shipping: toMoney(shippingCents),
    total: toMoney(totalCents),
    itemCount: priced.reduce((s, l) => s + l.quantity, 0),
  };
}
