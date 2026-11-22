import "./load-env";
import { migrate } from "./infrastructure/postgres/migrate";
import { createPool } from "./infrastructure/postgres/pool";
import { PostgresReportRepository } from "./infrastructure/postgres/postgres-report-repository";
import { SAMPLE_COUNT, sampleReports } from "./seed/sample-reports";

// npm run seed -w @asaase-ani/api
// Puts the ~200 labelled synthetic sample reports into the database in DATABASE_URL.
// Safe to run again: each sample has a fixed idempotency key, so nothing is duplicated.

if (process.env["NODE_ENV"] === "production") {
  console.error("Refusing to load sample reports into a production database.");
  process.exit(1);
}

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL is not set. Put it in the .env file in the project root.");
  process.exit(1);
}

const pool = createPool(url);
try {
  await migrate(pool);
  const repo = new PostgresReportRepository(pool);
  let created = 0;
  for (const { report, idempotencyKey } of sampleReports(new Date())) {
    if ((await repo.saveIfNew(report, idempotencyKey)).created) created++;
  }
  console.log(
    created > 0
      ? `Added ${created} sample reports (${SAMPLE_COUNT - created} were already there).`
      : `All ${SAMPLE_COUNT} sample reports were already there. Nothing added.`,
  );
} finally {
  await pool.end();
}
