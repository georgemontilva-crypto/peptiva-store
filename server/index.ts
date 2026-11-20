import path from "node:path";
import fs from "node:fs";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./trpc";
import { handleBankfulCallback } from "./lib/bankful-callback";
import { handleMedia } from "./lib/media";
import { handleCoaFile, handleCoaUpload } from "./lib/coa-files";
import { runMigrations } from "./db/migrate";
import { seedAdmin, seedIfEmpty } from "./db/seed";
import { runAbandonedCartJob } from "./lib/abandoned";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/media/wp/*path", (req, res) => {
  handleMedia(req, res).catch((err) => {
    console.error("[media] error", err);
    res.status(500).end();
  });
});

app.post("/admin-api/coa/upload", express.raw({ type: "*/*", limit: "16mb" }), (req, res) => {
  handleCoaUpload(req, res).catch((err) => {
    console.error("[coa] error al subir", err);
    res.status(500).json({ error: "The PDF could not be processed." });
  });
});
app.get("/coa-files/:id/:name", (req, res) => {
  handleCoaFile(req, res).catch(() => res.status(500).end());
});

app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// Bankful: misma ruta que usaba WooCommerce, para no cambiar nada en su panel
const bankfulBody = [express.urlencoded({ extended: false, limit: "100kb" }), express.json({ limit: "100kb" })];
const bankful = (req: express.Request, res: express.Response) => {
  handleBankfulCallback(req, res).catch((err) => {
    console.error("[bankful] error procesando callback", err);
    res.status(500).send("ERROR");
  });
};
app.get("/wc-api/bankful_callback", bankful);
app.post("/wc-api/bankful_callback", ...bankfulBody, bankful);

// URLs antiguas de WooCommerce → rutas nuevas (301, para conservar SEO)
app.get("/product-category/:slug", (req, res) => {
  res.redirect(301, `/shop?category=${encodeURIComponent(req.params.slug)}`);
});
const legacyRedirects: Record<string, string> = {
  "/privacy-policy-2": "/privacy-policy",
  "/checkout-page": "/checkout",
  "/cart": "/checkout",
  "/product-page": "/shop",
};
for (const [from, to] of Object.entries(legacyRedirects)) {
  app.get(from, (_req, res) => {
    res.redirect(301, to);
  });
}
// Cuentas de cliente llegan en una fase posterior: redirect temporal
for (const from of ["/login", "/register", "/affiliate-registration", "/affiliate-reset-password", "/affiliate-login"]) {
  app.get(from, (_req, res) => {
    res.redirect(302, from.startsWith("/affiliate") ? "/affiliate-account" : "/my-account");
  });
}
app.get("/all-shop", (_req, res) => {
  res.redirect(301, "/shop");
});
app.get("/shop", (req, res, next) => {
  const cat = req.query.product_cat;
  if (typeof cat === "string") return res.redirect(301, `/shop?category=${encodeURIComponent(cat)}`);
  next();
});

if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(process.cwd(), "dist/public");
  // Archivos con hash: caché larga. Si piden uno que ya no existe (deploy nuevo), 404 real, nunca el HTML.
  app.use("/assets", express.static(path.join(publicDir, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }));
  app.use(express.static(publicDir, { index: false, maxAge: "1h" }));
  const indexHtml = path.join(publicDir, "index.html");
  app.use((req, res, next) => {
    if (req.method !== "GET" || !fs.existsSync(indexHtml)) return next();
    // El HTML nunca se cachea: así cada visita toma el build más reciente
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(indexHtml);
  });
}

const port = Number(process.env.PORT ?? 3001);

async function main() {
  await runMigrations();
  await seedIfEmpty();
  await seedAdmin();

  // Recordatorios de carritos abandonados cada 5 minutos
  const job = () => runAbandonedCartJob().catch((err) => console.error("[abandoned] error en la tarea", err));
  setTimeout(job, 60_000);
  setInterval(job, 5 * 60_000);
  app.listen(port, () => console.log(`[server] escuchando en :${port}`));
}

main().catch((err) => {
  console.error("[server] error al arrancar", err);
  process.exit(1);
});
