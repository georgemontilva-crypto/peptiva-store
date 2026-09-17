import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { ZodError, z } from "zod";
import { withTimeout } from "./db";
import { COOKIE, parseCookies, readSession } from "./lib/auth";

export function createContext({ req, res }: CreateExpressContextOptions) {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ?? req.protocol;
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host;
  const baseUrl = (process.env.PUBLIC_URL || `${proto}://${host}`).replace(/\/$/, "");
  const cookies = parseCookies(req);
  return {
    req,
    res,
    ip: req.ip ?? "unknown",
    baseUrl,
    adminId: readSession(cookies[COOKIE.admin], "admin"),
    affiliateId: readSession(cookies[COOKIE.affiliate], "affiliate"),
  };
}
type Context = ReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: { ...shape.data, zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null },
    };
  },
});

export const router = t.router;

/** Ninguna llamada puede quedarse colgada: a los 10 s responde error y el navegador reintenta solo. */
const timeoutGuard = t.middleware(async ({ next, path }) => {
  try {
    return await withTimeout(next(), 10_000);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("La consulta superó")) {
      console.error(`[trpc] ${path} excedió el tiempo límite`);
      throw new TRPCError({ code: "TIMEOUT", message: "The request took too long. Retrying…" });
    }
    throw err;
  }
});

export const publicProcedure = t.procedure.use(timeoutGuard);
/** Sin límite de 10 s: solo para operaciones que esperan a un tercero (crear pago en Bankful). */
export const externalProcedure = t.procedure;

export const adminProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.adminId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to the admin." });
  return next({ ctx: { ...ctx, adminId: ctx.adminId } });
});

export const affiliateProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.affiliateId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to your affiliate account." });
  return next({ ctx: { ...ctx, affiliateId: ctx.affiliateId } });
});

/** Límite simple en memoria por IP y acción. */
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (recent.length >= max) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please wait a minute and try again." });
  }
  recent.push(now);
  hits.set(key, recent);
}
