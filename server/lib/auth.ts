import crypto from "node:crypto";
import type { Request, Response } from "express";

/** Hash de contraseñas con scrypt (formato: scrypt$salt$hash). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    // Sin SESSION_SECRET las sesiones se invalidan en cada reinicio, pero el sitio sigue funcionando
    if (!globalThis.__peptivaEphemeralSecret) {
      console.warn("[auth] SESSION_SECRET no está definida (mínimo 32 caracteres). Las sesiones se cerrarán en cada deploy.");
      globalThis.__peptivaEphemeralSecret = crypto.randomBytes(32).toString("hex");
    }
    return globalThis.__peptivaEphemeralSecret;
  }
  return "dev-secret-peptiva-store-0000000000000000";
}

declare global {
  // eslint-disable-next-line no-var
  var __peptivaEphemeralSecret: string | undefined;
}

type SessionKind = "admin" | "affiliate";
type SessionPayload = { k: SessionKind; id: number; exp: number };

const b64 = (s: string) => Buffer.from(s).toString("base64url");

export function signSession(kind: SessionKind, id: number, days = 7): string {
  const payload = b64(JSON.stringify({ k: kind, id, exp: Date.now() + days * 86_400_000 } satisfies SessionPayload));
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(token: string | undefined, kind: SessionKind): number | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (data.k !== kind || data.exp < Date.now()) return null;
    return data.id;
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export const COOKIE = { admin: "pv_admin", affiliate: "pv_aff" } as const;

export function setSessionCookie(res: Response, name: string, value: string, days = 7) {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: "lax",
    // En Railway llega por HTTPS (trust proxy lee x-forwarded-proto); en local por HTTP
    secure: res.req?.secure ?? process.env.NODE_ENV === "production",
    maxAge: days * 86_400_000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response, name: string) {
  res.clearCookie(name, { path: "/" });
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** URL pública del sitio para enlaces en emails enviados fuera de una petición (tareas programadas). */
export function publicUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${process.env.PORT ?? 3001}`;
}
