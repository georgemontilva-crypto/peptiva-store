import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");

/**
 * Railway corta en silencio las conexiones TCP inactivas. Si el pool reutiliza una de esas
 * conexiones muertas, la consulta se queda colgada y la página no carga hasta recargar.
 * Por eso: las conexiones libres se cierran a los 5 s, solo se guardan 2 en reserva y hay keepAlive.
 */
export const pool = mysql.createPool({
  uri: url,
  connectionLimit: 10,
  maxIdle: 2,
  idleTimeout: 5_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10_000,
});

/** Aborta cualquier consulta que tarde más de `ms` para que el cliente reintente en vez de esperar sin fin. */
export function withTimeout<T>(promise: Promise<T>, ms = 8_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`La consulta superó ${ms} ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
