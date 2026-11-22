import type { Express, Request, Response } from "express";
import { db } from "../db";
import { products } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * robots.txt, sitemap.xml y la cabecera de indexación.
 *
 * Antes estas dos rutas no existían y caían en el comodín que devuelve el HTML de la portada, así que
 * un buscador que pedía robots.txt recibía una página web. Además la vista previa de Railway se
 * declaraba indexable, con lo que el sitio de pruebas competía en Google con el dominio real.
 *
 * El dominio público se toma de PUBLIC_SITE_URL. Un despliegue cuyo host no sea ese dominio se trata
 * como vista previa: se marca noindex y robots.txt prohíbe el rastreo completo.
 */
const SITE_URL = (process.env.PUBLIC_SITE_URL ?? "https://peptivasupplies.com").replace(/\/+$/, "");

/** Páginas fijas, con la prioridad relativa que les corresponde. */
const STATIC_PATHS: [string, string, number][] = [
  ["/", "daily", 1.0],
  ["/shop", "daily", 0.9],
  ["/coas", "weekly", 0.8],
  ["/about-us", "monthly", 0.5],
  ["/faq", "monthly", 0.6],
  ["/contact", "monthly", 0.5],
  ["/affiliate", "monthly", 0.4],
  ["/shipping-policy", "yearly", 0.3],
  ["/return-refund", "yearly", 0.3],
  ["/terms-conditions", "yearly", 0.3],
  ["/privacy-policy", "yearly", 0.3],
];

/** Rutas que nunca deben indexarse: cuenta, carrito y cualquier cosa con token. */
const DISALLOW = ["/checkout", "/order-received/", "/my-account", "/affiliate-account", "/cart/", "/admin", "/trpc/"];

/** El host de la petición coincide con el dominio público declarado. */
function isPublicHost(req: Request): boolean {
  try {
    return req.hostname === new URL(SITE_URL).hostname;
  } catch {
    return false;
  }
}

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function registerSeoRoutes(app: Express) {
  // Toda respuesta fuera del dominio público se marca noindex, incluida la vista previa de Railway
  app.use((req, res, next) => {
    if (!isPublicHost(req)) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });

  app.get("/robots.txt", (req: Request, res: Response) => {
    res.type("text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (!isPublicHost(req)) return res.send("User-agent: *\nDisallow: /\n");
    res.send(["User-agent: *", "Allow: /", ...DISALLOW.map((p) => `Disallow: ${p}`), "", `Sitemap: ${SITE_URL}/sitemap.xml`, ""].join("\n"));
  });

  app.get("/sitemap.xml", (req: Request, res: Response) => {
    void (async () => {
      res.type("application/xml; charset=utf-8");
      if (!isPublicHost(req)) {
        res.setHeader("Cache-Control", "no-store");
        return res.send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
      }

      // Con un tope de espera: si la base tarda o no responde, el sitemap sale igual con las páginas
      // fijas en vez de dejar la petición colgada hasta que el buscador se rinda.
      let slugs: string[] = [];
      try {
        const rows = await Promise.race([
          db.select({ slug: products.slug }).from(products).where(eq(products.status, "active")),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("tiempo de espera agotado")), 2500)),
        ]);
        slugs = rows.map((r: { slug: string }) => r.slug);
      } catch (err) {
        console.warn("[sitemap] no se pudieron leer los productos:", err instanceof Error ? err.message : err);
      }

      const today = new Date().toISOString().slice(0, 10);
      const entry = (loc: string, changefreq: string, priority: number) =>
        `  <url>\n    <loc>${xmlEscape(SITE_URL + loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;

      const body = [
        ...STATIC_PATHS.map(([loc, freq, pri]) => entry(loc, freq, pri)),
        ...slugs.map((slug) => entry(`/product/${encodeURIComponent(slug)}`, "weekly", 0.8)),
      ].join("\n");

      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
    })();
  });
}
