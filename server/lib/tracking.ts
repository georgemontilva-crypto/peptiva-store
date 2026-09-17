export const CARRIERS = {
  usps: { label: "USPS", url: (n: string) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}` },
  ups: { label: "UPS", url: (n: string) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  fedex: { label: "FedEx", url: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  dhl: { label: "DHL", url: (n: string) => `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(n)}` },
  other: { label: "Other", url: (_n: string) => "" },
} as const;

export type CarrierKey = keyof typeof CARRIERS;

export function trackingLink(carrier: string | null | undefined, number: string | null | undefined, custom?: string | null) {
  if (custom) return custom;
  if (!carrier || !number) return null;
  const c = CARRIERS[carrier as CarrierKey];
  return c ? c.url(number) || null : null;
}

/** Texto que ve el cliente para cada estado. */
export const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Order confirmed",
  on_hold: "Payment under review",
  failed: "Payment failed",
  cancelled: "Cancelled",
  shipped: "Shipped",
  completed: "Delivered",
  refunded: "Refunded",
};
