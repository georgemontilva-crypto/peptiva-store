import { useEffect } from "react";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatPrice = (v: string | number) => usd.format(Number(v));

/** Actualiza <title> y meta description de la página actual. */
export function usePageMeta(title: string | undefined, description?: string | null) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}
