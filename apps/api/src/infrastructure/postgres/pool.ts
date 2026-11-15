import pg from "pg";
import type { Pool as PgPool } from "pg";

export type Database = PgPool;

export function createPool(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString, max: 10 });
  // An idle connection can fail (for example if the database restarts).
  // Without this handler that error would crash the whole process.
  pool.on("error", (error: Error) => {
    console.error("Unexpected database error:", error.message);
  });
  return pool;
}
