import request from "supertest";
import { wire } from "../composition-root";
import { createApp } from "../http/app";
import { FixedWindowRateLimiter } from "../infrastructure/fixed-window-rate-limiter";
import { InMemoryAuditLog } from "../infrastructure/in-memory-audit-log";
import { InMemoryReportRepository } from "../infrastructure/in-memory-report-repository";
import { InMemoryUserStore } from "../infrastructure/in-memory-user-store";
import { JwtTokenService } from "../infrastructure/jwt-token-service";
import { ScryptPasswordHasher } from "../infrastructure/scrypt-password-hasher";
import { FixedClock, RecordingNotifier, SequenceReferenceGenerator } from "./builders";

export const PASSWORD = "correct-horse-battery-1";

// Hashing is slow on purpose, so we do it once for the whole test run
let cachedHash: Promise<string> | undefined;
function passwordHash(): Promise<string> {
  cachedHash ??= new ScryptPasswordHasher().hash(PASSWORD);
  return cachedHash;
}

export type TestApp = ReturnType<typeof createApp>;

// A complete API on in-memory parts, with four known accounts:
//   officer@example.com   active officer, area "Sample Community"
//   admin@example.com     administrator
//   disabled@example.com  officer whose account is disabled
//   far@example.com       officer assigned to "Other District"
export async function setupHttp() {
  const clock = new FixedClock(); // time stands still, so rate-limit windows never expire mid-test
  const repo = new InMemoryReportRepository();
  const audit = new InMemoryAuditLog();
  const notifier = new RecordingNotifier();
  const tokens = new JwtTokenService("test-secret-0123456789-0123456789-abcdef", 3600);
  const users = new InMemoryUserStore();
  const hash = await passwordHash();

  users.add({ id: "officer-1", email: "officer@example.com", passwordHash: hash, role: "officer", areas: ["Sample Community"], active: true });
  users.add({ id: "admin-1", email: "admin@example.com", passwordHash: hash, role: "admin", areas: [], active: true });
  users.add({ id: "officer-off", email: "disabled@example.com", passwordHash: hash, role: "officer", areas: ["Sample Community"], active: false });
  users.add({ id: "officer-far", email: "far@example.com", passwordHash: hash, role: "officer", areas: ["Other District"], active: true });

  const services = wire({
    repo,
    audit,
    users,
    hasher: new ScryptPasswordHasher(),
    tokens,
    refs: new SequenceReferenceGenerator(),
    notifier,
    clock,
  });

  const app = createApp(services, {
    limiters: {
      submit: new FixedWindowRateLimiter(clock, 100, 60_000),
      track: new FixedWindowRateLimiter(clock, 5, 60_000),
      login: new FixedWindowRateLimiter(clock, 5, 60_000),
    },
    onUnexpectedError: () => {}, // keep test output quiet
  });

  async function loginAs(email: string): Promise<string> {
    const response = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
    return String(response.body.token);
  }

  return { app, repo, audit, notifier, tokens, loginAs };
}
