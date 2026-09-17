import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./lib/trpc";
import { CartProvider } from "./lib/cart";
import App from "./App";
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
              const timeout = AbortSignal.timeout(15_000);
              const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
              return fetch(input, { ...init, signal });
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
