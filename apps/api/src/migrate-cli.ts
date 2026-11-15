import "./load-env";
import { migrate } from "./infrastructure/postgres/migrate";
import { createPool } from "./infrastructure/postgres/pool";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL is not set. Put it in the .env file in the project root.");
  process.exit(1);
}

const pool = createPool(url);
try {
  const applied = await migrate(pool);
  console.log(applied.length > 0 ? `Applied: ${applied.join(", ")}` : "Database is already up to date.");
} finally {
  await pool.end();
}
