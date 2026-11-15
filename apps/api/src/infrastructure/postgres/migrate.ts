import { readdir, readFile } from "node:fs/promises";
import type { Database } from "./pool";

// apps/api/migrations/, found relative to THIS file so it works from any folder.
// URLs (not plain text paths) keep spaces in folder names working on Windows.
const DEFAULT_DIR = new URL("../../../migrations/", import.meta.url);

const LOCK_ID = 727001; // any fixed number: only one process may migrate at a time

// Applies every .sql file that has not run yet, in name order. Returns the names it applied.
export async function migrate(pool: Database, dir: URL = DEFAULT_DIR): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );

    const done = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const alreadyApplied = new Set(done.rows.map((row) => row.name));

    const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
    for (const file of files) {
      if (alreadyApplied.has(file)) continue;
      const sql = await readFile(new URL(file, dir), "utf8");
      try {
        await client.query("BEGIN"); // each migration is all-or-nothing
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => undefined);
    client.release();
  }
  return applied;
}
