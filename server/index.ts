import path from "node:path";
import fs from "node:fs";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { runMigrations } from "./db/migrate";
import { seedIfEmpty } from "./db/seed";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.use("/trpc", createExpressMiddleware({ router: appRouter }));

// URLs antiguas de WooCommerce → rutas nuevas (301, para conservar SEO)
app.get("/product-category/:slug", (req, res) => {
  res.redirect(301, `/shop?category=${encodeURIComponent(req.params.slug)}`);
});
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
  app.use(express.static(publicDir, { index: false, maxAge: "1h" }));
  app.use("/assets", express.static(path.join(publicDir, "assets"), { immutable: true, maxAge: "1y" }));
  const indexHtml = path.join(publicDir, "index.html");
  app.use((req, res, next) => {
    if (req.method !== "GET" || !fs.existsSync(indexHtml)) return next();
    res.sendFile(indexHtml);
  });
}

const port = Number(process.env.PORT ?? 3001);

async function main() {
  await runMigrations();
  await seedIfEmpty();
  app.listen(port, () => console.log(`[server] escuchando en :${port}`));
}

main().catch((err) => {
  console.error("[server] error al arrancar", err);
  process.exit(1);
});
