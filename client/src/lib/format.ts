import { useEffect } from "react";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatPrice = (v: string | number) => usd.format(Number(v));

export const SITE_URL = "https://peptivasupplies.com";

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Actualiza el <title>, la descripción, la URL canónica y las etiquetas Open Graph de la página actual.
 * La canónica y og:url evitan que el buscador indexe la misma página con parámetros distintos.
 */
export function usePageMeta(title: string | undefined, description?: string | null, options?: { image?: string; type?: string }) {
  const image = options?.image;
  const type = options?.type ?? "website";
  useEffect(() => {
    if (title) {
      document.title = title;
      setMeta('meta[property="og:title"]', "property", "og:title", title);
      setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    }
    if (description) {
      setMeta('meta[name="description"]', "name", "description", description);
      setMeta('meta[property="og:description"]', "property", "og:description", description);
      setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    }
    setMeta('meta[property="og:type"]', "property", "og:type", type);

    const url = SITE_URL + window.location.pathname;
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;
    setMeta('meta[property="og:url"]', "property", "og:url", url);

    if (image) {
      const abs = image.startsWith("http") ? image : SITE_URL + image;
      setMeta('meta[property="og:image"]', "property", "og:image", abs);
      setMeta('meta[name="twitter:image"]', "name", "twitter:image", abs);
    }
  }, [title, description, image, type]);
}

/**
 * Inserta un bloque JSON-LD en el <head> mientras la página está montada y lo retira al salir.
 * Cada bloque lleva su propio id para que no se dupliquen al navegar.
 */
export function useJsonLd(id: string, data: unknown | null | undefined) {
  const json = data ? JSON.stringify(data) : "";
  useEffect(() => {
    if (!json) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = `ld-${id}`;
    el.textContent = json;
    document.head.querySelector(`#ld-${id}`)?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [id, json]);
}

/** Migas de pan en JSON-LD: ayudan a que el buscador muestre la ruta bajo el resultado. */
export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: SITE_URL + t.path,
    })),
  };
}
