import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = { productId: number; variantId: number | null; quantity: number };

type CartState = {
  items: CartItem[];
  couponCode: string | null;
  count: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: CartItem) => void;
  setQuantity: (productId: number, variantId: number | null, quantity: number) => void;
  remove: (productId: number, variantId: number | null) => void;
  setCoupon: (code: string | null) => void;
  clear: () => void;
  /** Reemplaza el carrito (recuperación desde el email de carrito abandonado). */
  replace: (items: CartItem[], couponCode: string | null) => void;
  /** Identificador del carrito para los recordatorios; cambia después de cada compra. */
  token: string;
};

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = "peptiva.cart.v1";
const same = (a: CartItem, productId: number, variantId: number | null) => a.productId === productId && a.variantId === variantId;

const newToken = () => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

function load(): { items: CartItem[]; couponCode: string | null; token: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { items?: CartItem[]; couponCode?: string | null; token?: string };
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        couponCode: parsed.couponCode ?? null,
        token: typeof parsed.token === "string" && parsed.token.length >= 16 ? parsed.token : newToken(),
      };
    }
  } catch {
    /* almacenamiento no disponible */
  }
  return { items: [], couponCode: null, token: newToken() };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignorar */
    }
  }, [state]);

  const add = useCallback((item: CartItem) => {
    setState((s) => {
      const existing = s.items.find((i) => same(i, item.productId, item.variantId));
      const items = existing
        ? s.items.map((i) => (i === existing ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) } : i))
        : [...s.items, item];
      return { ...s, items };
    });
    setOpen(true);
  }, []);

  const setQuantity = useCallback((productId: number, variantId: number | null, quantity: number) => {
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (same(i, productId, variantId) ? { ...i, quantity: Math.max(1, Math.min(99, quantity)) } : i)),
    }));
  }, []);

  const remove = useCallback((productId: number, variantId: number | null) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => !same(i, productId, variantId)) }));
  }, []);

  const value = useMemo<CartState>(
    () => ({
      items: state.items,
      couponCode: state.couponCode,
      count: state.items.reduce((n, i) => n + i.quantity, 0),
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      add,
      setQuantity,
      remove,
      setCoupon: (couponCode) => setState((s) => ({ ...s, couponCode })),
      clear: () => setState({ items: [], couponCode: null, token: newToken() }),
      replace: (items, couponCode) => setState((s) => ({ ...s, items, couponCode })),
      token: state.token,
    }),
    [state, isOpen, add, setQuantity, remove],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
