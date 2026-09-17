import { pool } from "./index";
import { runMigrations } from "./migrate";
import { seedCatalog } from "./seed";

await runMigrations();
await seedCatalog();
await pool.end();
