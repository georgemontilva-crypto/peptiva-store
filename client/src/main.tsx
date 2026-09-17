import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./lib/trpc";
import { CartProvider } from "./lib/cart";
import App from "./App";
import RootRecovery from "./components/RootRecovery";
import "./styles.css";

function Root() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 3, retryDelay: (n) => Math.min(500 * 2 ** n, 3000), refetchOnWindowFocus: false } } }));
  const [trpcClient] = useState(() => trpc.createClient({ links: [
          httpBatchLink({
            url: "/trpc",
            transformer: superjson,
            // Lecturas (GET): si no responden en 15 s se cortan y React Query reintenta, así la página nunca queda esperando.
            // Las mutaciones (POST, p. ej. abrir el pago) no llevan este límite.
            fetch: (input, init) => {
              if ((init?.method ?? "GET").toUpperCase() !== "GET") return fetch(input, init);
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 15_000);
              // Compatible con Safari antiguo (sin AbortSignal.any / AbortSignal.timeout)
              init?.signal?.addEventListener("abort", () => controller.abort(), { once: true });
              return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
            },
          }),
        ] }));
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CartProvider>
            <App />
          </CartProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * El traductor de Chrome (y extensiones como Grammarly) reemplazan nodos de texto por sus propios elementos.
 * Cuando React luego intenta quitar o insertar esos nodos, lanza "removeChild/insertBefore: not a child"
 * y la app entera se desmonta: pantalla en blanco al navegar. Este parche hace esas operaciones tolerantes.
 */
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn("[dom] removeChild ignorado: el nodo ya no pertenece a este padre (traductor/extensión)");
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn("[dom] insertBefore sin referencia válida (traductor/extensión)");
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

const bootErrors = (window as unknown as { __bootErrors?: string[] }).__bootErrors;
const report = (label: string) => (error: unknown) => {
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  bootErrors?.push(`${label}: ${msg}`);
  console.error(`[react] ${label}`, error);
};

// Si una imagen externa no carga, se reemplaza por un marcador en vez de dejar un hueco en blanco
const IMG_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f2f5f9"/><rect x="170" y="110" width="60" height="26" rx="6" fill="#15426e"/><rect x="155" y="136" width="90" height="160" rx="18" fill="none" stroke="#15426e" stroke-width="8"/><rect x="163" y="210" width="74" height="78" rx="10" fill="#0fb0b3"/></svg>');
document.addEventListener(
  "error",
  (e) => {
    const el = e.target;
    if (el instanceof HTMLImageElement && el.src !== IMG_FALLBACK) el.src = IMG_FALLBACK;
  },
  true,
);

createRoot(document.getElementById("root")!, {
  onUncaughtError: report("uncaught"),
  onCaughtError: report("caught"),
  onRecoverableError: report("recoverable"),
}).render(
  <StrictMode>
    <RootRecovery>
      <Root />
    </RootRecovery>
  </StrictMode>,
);
