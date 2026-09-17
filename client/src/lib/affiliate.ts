const KEY = "peptiva.ref.v1";

/** Código de afiliado vigente (guardado al entrar por un enlace ?ref=). */
export function getAffiliateCode(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, expires } = JSON.parse(raw) as { code: string; expires: number };
    if (!code || Date.now() > expires) {
      localStorage.removeItem(KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function storeAffiliateCode(code: string, days: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, expires: Date.now() + days * 86_400_000 }));
  } catch {
    /* ignorar */
  }
}

/** Lee ?ref= o ?aff= (el parámetro que usaba SliceWP) de la URL actual. */
export function readRefParam(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get("ref") ?? params.get("aff");
  return code && /^[a-zA-Z0-9-]{1,40}$/.test(code) ? code : null;
}
