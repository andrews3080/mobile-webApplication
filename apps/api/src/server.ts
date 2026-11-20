import "./load-env";
import { createHmac, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { PhotoStore } from "./application/photo-ports";
import type { AuditLog, ReportRepository } from "./application/ports";
import type { UserFinder } from "./application/security-ports";
import { wire } from "./composition-root";
import type { UserAccount } from "./domain/user-account";
import { createApp } from "./http/app";
import { ConsoleNotifier } from "./infrastructure/console-notifier";
import { FixedWindowRateLimiter } from "./infrastructure/fixed-window-rate-limiter";
import { HmacUploadSigner } from "./infrastructure/hmac-upload-signer";
import { ImageMetadataStripper } from "./infrastructure/image-metadata-stripper";
import { InMemoryAuditLog } from "./infrastructure/in-memory-audit-log";
import { InMemoryPhotoStore } from "./infrastructure/in-memory-photo-store";
import { InMemoryReportRepository } from "./infrastructure/in-memory-report-repository";
import { InMemoryUserStore } from "./infrastructure/in-memory-user-store";
import { JwtTokenService } from "./infrastructure/jwt-token-service";
import { LocalDiskPhotoStore } from "./infrastructure/local-disk-photo-store";
import { migrate } from "./infrastructure/postgres/migrate";
import { PostgresAuditLog } from "./infrastructure/postgres/postgres-audit-log";
import { PostgresReportRepository } from "./infrastructure/postgres/postgres-report-repository";
import { PostgresUserStore } from "./infrastructure/postgres/postgres-user-store";
import { createPool } from "./infrastructure/postgres/pool";
import type { Database } from "./infrastructure/postgres/pool";
import { RandomIdGenerator } from "./infrastructure/random-id-generator";
import { RandomReferenceGenerator } from "./infrastructure/random-reference-generator";
import { ScryptPasswordHasher } from "./infrastructure/scrypt-password-hasher";
import { SystemClock } from "./infrastructure/system-clock";

const isProduction = process.env["NODE_ENV"] === "production";
const databaseUrl = process.env["DATABASE_URL"];

if (isProduction && !databaseUrl) {
  throw new Error("Production needs DATABASE_URL (the PostgreSQL connection string).");
}

let secret = process.env["JWT_SECRET"] ?? "";
if (secret.length < 32) {
  if (isProduction) throw new Error("Production needs JWT_SECRET with at least 32 characters.");
  secret = randomBytes(32).toString("hex");
  console.warn("JWT_SECRET not set. Using a temporary secret for this run.");
}

const clock = new SystemClock();
const hasher = new ScryptPasswordHasher();

// Upload links are signed with a key derived from the main secret, so one secret still runs everything
const uploadSecret = createHmac("sha256", secret).update("asaase-ani-upload-v1").digest("hex");

// With a database we keep photos on disk (folder "uploads" in the project root). Without one, in memory.
const uploadDir = process.env["UPLOAD_DIR"] ?? fileURLToPath(new URL("../../../uploads/", import.meta.url));
const photos: PhotoStore = databaseUrl ? new LocalDiskPhotoStore(uploadDir) : new InMemoryPhotoStore();

// Development only: one officer with a random password, printed once per start
async function makeDevOfficer(): Promise<{ account: UserAccount; password: string }> {
  const password = randomBytes(9).toString("base64url");
  const account: UserAccount = {
    id: "dev-officer-1",
    email: "officer@example.com",
    passwordHash: await hasher.hash(password),
    role: "officer",
    // Districts from the shared list, separated by ";" (area names can contain commas)
    areas: (process.env["DEV_AREAS"] ?? "Tarkwa-Nsuaem Municipal;District not known, Western Region")
      .split(";")
      .map((area) => area.trim())
      .filter((area) => area.length > 0),
    active: true,
  };
  return { account, password };
}

function announce(dev: { account: UserAccount; password: string }): void {
  console.log(`Dev officer ready. Email: ${dev.account.email}  Password: ${dev.password}`);
}

let pool: Database | undefined;
let repo: ReportRepository;
let audit: AuditLog;
let users: UserFinder;

if (databaseUrl) {
  pool = createPool(databaseUrl);
  const applied = await migrate(pool);
  if (applied.length > 0) console.log(`Applied migrations: ${applied.join(", ")}`);

  const store = new PostgresUserStore(pool);
  repo = new PostgresReportRepository(pool);
  audit = new PostgresAuditLog(pool);
  users = store;

  if (!isProduction) {
    const dev = await makeDevOfficer();
    await store.save(dev.account);
    announce(dev);
  }
  console.log("Using PostgreSQL storage.");
} else {
  const store = new InMemoryUserStore();
  repo = new InMemoryReportRepository();
  audit = new InMemoryAuditLog();
  users = store;

  const dev = await makeDevOfficer();
  store.add(dev.account);
  announce(dev);
  console.warn("DATABASE_URL not set. Using in-memory storage: all data disappears on restart.");
}

const services = wire({
  repo,
  audit,
  users,
  hasher,
  tokens: new JwtTokenService(secret, 8 * 60 * 60),
  refs: new RandomReferenceGenerator(),
  notifier: new ConsoleNotifier(),
  clock,
  photos,
  sanitiser: new ImageMetadataStripper(),
  signer: new HmacUploadSigner(uploadSecret),
  ids: new RandomIdGenerator(),
});

const corsOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
if (corsOrigins.length > 0) console.log(`Allowing browser calls from: ${corsOrigins.join(", ")}`);

const app = createApp(services, {
  corsOrigins,
  limiters: {
    submit: new FixedWindowRateLimiter(clock, 60, 10 * 60 * 1000), // 60 per 10 min per address
    track: new FixedWindowRateLimiter(clock, 30, 60 * 1000), // 30 per minute per address
    login: new FixedWindowRateLimiter(clock, 10, 15 * 60 * 1000), // 10 per 15 min per address
    upload: new FixedWindowRateLimiter(clock, 300, 10 * 60 * 1000), // slots and uploads: up to 5 photos per report
  },
});

const port = Number(process.env["PORT"] ?? 3000);
const server = app.listen(port, () => console.log(`Asaase Ani API listening on http://localhost:${port}`));

// Close the server and the database connections cleanly on Ctrl+C
async function shutdown(): Promise<void> {
  server.close();
  await pool?.end();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
