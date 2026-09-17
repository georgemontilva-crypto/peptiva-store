import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");

// keepAlive + idleTimeout: Railway cierra conexiones inactivas; sin esto la primera consulta tras un rato puede colgarse
export const pool = mysql.createPool({
  uri: url,
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  connectTimeout: 10_000,
});
export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
