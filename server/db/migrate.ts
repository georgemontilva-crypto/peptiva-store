import path from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { db } from "./index";

/** Aplica las migraciones commiteadas en /drizzle al arrancar. Nunca usar drizzle-kit push. */
export async function runMigrations() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  await migrate(db, { migrationsFolder });
  console.log("[db] migraciones aplicadas");
}
