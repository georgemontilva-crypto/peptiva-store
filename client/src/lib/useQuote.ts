import { trpc } from "./trpc";
import { useCart } from "./cart";

/** Precios del carrito calculados en el servidor. */
export function useQuote() {
  const cart = useCart();
  const query = trpc.shop.quote.useQuery(
    { lines: cart.items, couponCode: cart.couponCode },
    { enabled: cart.items.length > 0, placeholderData: (prev) => prev },
  );
  return { cart, quote: cart.items.length ? query.data : undefined, isLoading: query.isLoading && cart.items.length > 0 };
}
