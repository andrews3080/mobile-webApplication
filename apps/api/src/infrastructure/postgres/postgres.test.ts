import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { wire } from "../../composition-root";
import { createApp } from "../../http/app";
import { Location } from "../../domain/location";
import { ReferenceCode } from "../../domain/reference-code";
import { FixedWindowRateLimiter } from "../fixed-window-rate-limiter";
import { JwtTokenService } from "../jwt-token-service";
import { RandomReferenceGenerator } from "../random-reference-generator";
import { ScryptPasswordHasher } from "../scrypt-password-hasher";
import { aReport, FixedClock, LATER, RecordingNotifier } from "../../test-support/builders";
import { PASSWORD } from "../../test-support/http-setup";
import { makePhotoParts } from "../../test-support/photo-parts";
import { reportRepositoryContract } from "../../test-support/report-repository.contract";
import { reportReviewStoreContract } from "../../test-support/report-review-store.contract";
import { migrate } from "./migrate";
import { createPool } from "./pool";
import { PostgresAuditLog } from "./postgres-audit-log";
import { PostgresReportRepository } from "./postgres-report-repository";
import { PostgresUserStore } from "./postgres-user-store";

// All PostgreSQL tests live in ONE file on purpose: files run in parallel, and
// parallel files would wipe each other's data in the shared test database.

const url = process.env["TEST_DATABASE_URL"];

if (!url) {
  describe("PostgreSQL adapters", () => {
    it.skip("skipped because TEST_DATABASE_URL is not set (see the .env file)", () => {});
  });
} else {
  // Safety: these tests DELETE everything, so only a database named *_test is allowed
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Refusing to run tests on "${databaseName}". The test database name must end with _test.`);
  }

  const pool = createPool(url);

  describe("PostgreSQL adapters", () => {
    beforeAll(async () => {
      await migrate(pool);
    });
    beforeEach(async () => {
      await pool.query("TRUNCATE audit_log, status_events, reports, users RESTART IDENTITY");
    });
    afterAll(async () => {
      await pool.end();
    });

    // The SAME rules the in-memory repository obeys. This is Liskov Substitution, proven.
    reportRepositoryContract("PostgresReportRepository", () => new PostgresReportRepository(pool));
    reportReviewStoreContract("PostgresReportRepository", () => new PostgresReportRepository(pool));

    describe("report storage details", () => {
      it("stores and returns every field, including coordinates, contact and history", async () => {
        const repo = new PostgresReportRepository(pool);
        const original = aReport("AAAA-AAAA-AAAA", {
          location: Location.create({
            area: "Sample Community",
            latitude: 5.123456,
            longitude: -0.654321,
            placeDetails: "Behind the old school, near the river bridge",
          }),
          contact: { name: "Kwame Test", phone: "0240000000", email: "kwame@example.com" },
          photoKeys: ["photos/a.jpg", "photos/b.jpg"],
        })
          .transitionTo("under_review", "officer-1", LATER)
          .transitionTo("verified", "officer-1", LATER, "Photos match the site");

        await repo.saveIfNew(original, "key-aaaaaaaaaaaaaaaa");
        const found = await repo.findByReference(ReferenceCode.parse("AAAA-AAAA-AAAA"));
        expect(found).toEqual(original);
      });

      it("handles a report with no GPS and no contact", async () => {
        const repo = new PostgresReportRepository(pool);
        await repo.saveIfNew(aReport("AAAA-AAAA-AAAA"), "key-aaaaaaaaaaaaaaaa");
        const found = await repo.findByReference(ReferenceCode.parse("AAAA-AAAA-AAAA"));
        expect(found?.location.hasCoordinates).toBe(false);
        expect(found?.contact).toBeUndefined();
        expect(found?.photoKeys).toEqual([]);
      });

      it("stores hostile-looking text as plain text (no SQL injection)", async () => {
        const repo = new PostgresReportRepository(pool);
        const nasty = "'); DROP TABLE reports; -- muddy water everywhere";
        await repo.saveIfNew(aReport("AAAA-AAAA-AAAA", { description: nasty }), "key-aaaaaaaaaaaaaaaa");
        const found = await repo.findByReference(ReferenceCode.parse("AAAA-AAAA-AAAA"));
        expect(found?.description).toBe(nasty);
      });

      it("saves a report that already has history, in order", async () => {
        const repo = new PostgresReportRepository(pool);
        const reviewed = aReport("AAAA-AAAA-AAAA")
          .transitionTo("under_review", "officer-1", LATER)
          .transitionTo("more_information_requested", "officer-2", LATER, "Which side of the river?");
        await repo.saveIfNew(reviewed, "key-aaaaaaaaaaaaaaaa");
        const found = await repo.findByReference(ReferenceCode.parse("AAAA-AAAA-AAAA"));
        expect(found?.history.map((event) => event.to)).toEqual(["under_review", "more_information_requested"]);
      });

      it("refuses bad data even if the application code is bypassed", async () => {
        await expect(
          pool.query(
            `INSERT INTO reports (reference, idempotency_key, description, category, observed_at, created_at, area, area_key, status)
             VALUES ('X', 'k', 'd', 'c', now(), now(), 'a', 'a', 'banana')`,
          ),
        ).rejects.toThrow();
      });
    });

    describe("PostgresUserStore", () => {
      const account = {
        id: "officer-1",
        email: "Officer@Example.com",
        passwordHash: "scrypt$aa$bb",
        role: "officer" as const,
        areas: ["Sample Community", "Other District"],
        active: true,
      };

      it("finds a user by email regardless of capital letters", async () => {
        const users = new PostgresUserStore(pool);
        await users.save(account);
        expect((await users.findByEmail("  officer@example.COM "))?.id).toBe("officer-1");
      });

      it("finds a user by id, with role, areas and status intact", async () => {
        const users = new PostgresUserStore(pool);
        await users.save(account);
        expect(await users.findById("officer-1")).toEqual(account);
      });

      it("returns null for an unknown email or id", async () => {
        const users = new PostgresUserStore(pool);
        expect(await users.findByEmail("nobody@example.com")).toBeNull();
        expect(await users.findById("nobody")).toBeNull();
      });

      it("updates an existing account when saved again (for example, disabling it)", async () => {
        const users = new PostgresUserStore(pool);
        await users.save(account);
        await users.save({ ...account, active: false });
        expect((await users.findById("officer-1"))?.active).toBe(false);
      });

      it("refuses two accounts with the same email", async () => {
        const users = new PostgresUserStore(pool);
        await users.save(account);
        await expect(users.save({ ...account, id: "officer-2", email: "OFFICER@example.com" })).rejects.toThrow();
      });
    });

    describe("PostgresAuditLog", () => {
      it("records entries and reads them back in order", async () => {
        const audit = new PostgresAuditLog(pool);
        await audit.record({ actorId: "officer-1", action: "report.view", target: "AAAA-AAAA-AAAA", outcome: "allowed", at: LATER });
        await audit.record({ actorId: "admin-1", action: "reports.list", outcome: "denied", detail: "role is not allowed", at: LATER });

        const entries = await audit.entries();
        expect(entries.map((entry) => entry.outcome)).toEqual(["allowed", "denied"]);
        expect(entries[1]?.detail).toBe("role is not allowed");
        expect(entries[1]?.target).toBeUndefined();
      });

      it("cannot be edited or deleted, even with direct database access", async () => {
        const audit = new PostgresAuditLog(pool);
        await audit.record({ actorId: "officer-1", action: "report.view", outcome: "allowed", at: LATER });
        await expect(pool.query("UPDATE audit_log SET outcome = 'denied'")).rejects.toThrow(/append-only/);
        await expect(pool.query("DELETE FROM audit_log")).rejects.toThrow(/append-only/);
        expect(await audit.entries()).toHaveLength(1);
      });
    });

    describe("migrations", () => {
      it("are safe to run again (nothing new is applied)", async () => {
        expect(await migrate(pool)).toEqual([]);
      });
    });

    describe("the whole API on PostgreSQL", () => {
      it("runs a full flow, and two officers acting at once cannot both win", async () => {
        const hasher = new ScryptPasswordHasher();
        const hash = await hasher.hash(PASSWORD);
        const users = new PostgresUserStore(pool);
        const audit = new PostgresAuditLog(pool);
        const tokens = new JwtTokenService("test-secret-0123456789-0123456789-abcdef", 3600);
        const clock = new FixedClock();

        await users.save({ id: "officer-1", email: "one@example.com", passwordHash: hash, role: "officer", areas: ["Sample Community"], active: true });
        await users.save({ id: "officer-2", email: "two@example.com", passwordHash: hash, role: "officer", areas: ["Sample Community"], active: true });
        await users.save({ id: "officer-far", email: "far@example.com", passwordHash: hash, role: "officer", areas: ["Other District"], active: true });

        const services = wire({
          repo: new PostgresReportRepository(pool),
          audit,
          users,
          hasher,
          tokens,
          refs: new RandomReferenceGenerator(),
          notifier: new RecordingNotifier(),
          ...makePhotoParts(),
          clock,
        });
        const app = createApp(services, {
          limiters: {
            submit: new FixedWindowRateLimiter(clock, 100, 60_000),
            track: new FixedWindowRateLimiter(clock, 100, 60_000),
            login: new FixedWindowRateLimiter(clock, 100, 60_000),
            upload: new FixedWindowRateLimiter(clock, 100, 60_000),
          },
          onUnexpectedError: () => {},
        });

        async function login(email: string): Promise<string> {
          const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
          return String(res.body.token);
        }

        // 1. A reporter submits (and a retry changes nothing)
        const body = {
          description: "Muddy water and diggers near the river bank",
          category: "river_pollution",
          observedAt: "2026-11-14T08:00:00Z",
          area: "Sample Community",
          contact: { phone: "0240000000" },
        };
        const key = "11111111-2222-3333-4444-555555555555";
        const first = await request(app).post("/api/reports").set("Idempotency-Key", key).send(body);
        const retry = await request(app).post("/api/reports").set("Idempotency-Key", key).send(body);
        expect(first.status).toBe(201);
        expect(retry.status).toBe(200);
        expect(retry.body.reference).toBe(first.body.reference);
        const reference = String(first.body.reference);

        // 2. Two officers press "start review" at the same moment: exactly one wins
        const tokenOne = await login("one@example.com");
        const tokenTwo = await login("two@example.com");
        const [a, b] = await Promise.all([
          request(app).post(`/api/officer/reports/${reference}/start-review`).set("Authorization", `Bearer ${tokenOne}`),
          request(app).post(`/api/officer/reports/${reference}/start-review`).set("Authorization", `Bearer ${tokenTwo}`),
        ]);
        const codes = [a.status, b.status];
        expect(codes.filter((code) => code === 200)).toHaveLength(1);
        expect([409, 422]).toContain(codes.find((code) => code !== 200));

        // 3. The history has exactly one entry, and the reporter sees the new status
        const detail = await request(app).get(`/api/officer/reports/${reference}`).set("Authorization", `Bearer ${tokenOne}`);
        expect(detail.body.history).toHaveLength(1);
        expect(detail.body.contact.phone).toBe("0240000000");

        const tracked = await request(app).get(`/api/track/${reference}`);
        expect(tracked.body.status).toBe("under_review");
        expect(JSON.stringify(tracked.body)).not.toContain("0240000000");
        expect(JSON.stringify(tracked.body)).not.toContain("officer-");

        // 4. An officer from another area is refused, and the refusal is in the database
        const farToken = await login("far@example.com");
        const refused = await request(app).get(`/api/officer/reports/${reference}`).set("Authorization", `Bearer ${farToken}`);
        expect(refused.status).toBe(403);
        const entries = await audit.entries();
        expect(entries.some((entry) => entry.actorId === "officer-far" && entry.outcome === "denied")).toBe(true);
      });
    });
  });
}
