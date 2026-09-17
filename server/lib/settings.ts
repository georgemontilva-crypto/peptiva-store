import { db, schema } from "../db";

export const DEFAULT_SETTINGS = {
  /** % de comisión general para afiliados */
  commissionRate: 10,
  /** Días que dura la atribución de un enlace de afiliado */
  cookieDays: 30,
  /** Pago mínimo a afiliados en USD */
  minPayout: 25,
  /** Aprobar comisiones automáticamente cuando el pedido pasa a Completed */
  autoApproveOnComplete: true,
  abandonedEnabled: true,
  /** Minutos sin comprar antes del primer email */
  abandonedFirstDelayMinutes: 60,
  /** Horas antes del segundo email (desde el primero) */
  abandonedSecondDelayHours: 24,
  /** Cupón opcional que se ofrece en el segundo email */
  abandonedCouponCode: "" as string,
};

export type StoreSettings = typeof DEFAULT_SETTINGS;

let cache: { value: StoreSettings; at: number } | null = null;

export async function getSettings(): Promise<StoreSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const rows = await db.select().from(schema.settings);
  const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  cache = { value: merged as StoreSettings, at: Date.now() };
  return cache.value;
}

export async function updateSettings(patch: Partial<StoreSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await db.insert(schema.settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  }
  cache = null;
  return getSettings();
}
