import { describe, it, expect } from "vitest";
import request from "supertest";
import { setupHttp } from "../test-support/http-setup";
import type { TestApp } from "../test-support/http-setup";

const KEY = "11111111-2222-3333-4444-555555555555";

const REPORT = {
  description: "Muddy water and diggers near the river bank",
  category: "river_pollution",
  observedAt: "2026-11-14T08:00:00Z",
  area: "Sample Community",
  latitude: 5.123456,
  longitude: -0.654321,
  contact: { name: "Kwame Test", phone: "0240000000", email: "kwame@example.com" },
};

function submit(app: TestApp, body: object = REPORT, key: string = KEY) {
  return request(app).post("/api/reports").set("Idempotency-Key", key).send(body);
}

function bearer(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}

describe("general behaviour", () => {
  it("answers the health check", async () => {
    const { app } = await setupHttp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("hides the server type and forbids caching", async () => {
    const { app } = await setupHttp();
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("answers 404 in our own format for unknown routes", async () => {
    const { app } = await setupHttp();
    const res = await request(app).get("/api/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});

describe("submitting a report", () => {
  it("creates a report and returns the reference code (201)", async () => {
    const { app, notifier } = await setupHttp();
    const res = await submit(app);
    expect(res.status).toBe(201);
    expect(res.body.reference).toBe("0000-0000-0001");
    expect(res.body.alreadyReceived).toBe(false);
    expect(notifier.sent).toHaveLength(1);
  });

  it("answers a retry with the same code, 200, and no duplicate", async () => {
    const { app, repo, notifier } = await setupHttp();
    const first = await submit(app);
    const retry = await submit(app);
    expect(retry.status).toBe(200);
    expect(retry.body.reference).toBe(first.body.reference);
    expect(retry.body.alreadyReceived).toBe(true);
    expect(repo.count()).toBe(1);
    expect(notifier.sent).toHaveLength(1);
  });

  it("refuses a request without the Idempotency-Key header (400)", async () => {
    const { app } = await setupHttp();
    const res = await request(app).post("/api/reports").send(REPORT);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("bad_request");
  });

  it("explains a business-rule failure (422) and saves nothing", async () => {
    const { app, repo } = await setupHttp();
    const res = await submit(app, { ...REPORT, description: "short" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("validation_failed");
    expect(repo.count()).toBe(0);
  });

  it("refuses the wrong type of data (400)", async () => {
    const { app } = await setupHttp();
    const res = await submit(app, { ...REPORT, description: 123 });
    expect(res.status).toBe(400);
  });

  it("refuses a body that is not JSON (400)", async () => {
    const { app } = await setupHttp();
    const res = await request(app)
      .post("/api/reports")
      .set("Idempotency-Key", KEY)
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("JSON");
  });
});

describe("tracking a report", () => {
  it("shows the public status without any private data", async () => {
    const { app } = await setupHttp();
    const submitted = await submit(app);
    const res = await request(app).get(`/api/track/${submitted.body.reference}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("received");
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("Kwame");
    expect(text).not.toContain("0240000000");
    expect(text).not.toContain("5.123456");
    expect(text).not.toContain("Muddy water");
  });

  it("answers an unknown code and a malformed code identically", async () => {
    const { app } = await setupHttp();
    const unknown = await request(app).get("/api/track/CCCC-CCCC-CCCC");
    const malformed = await request(app).get("/api/track/hello");
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
    expect(malformed.body).toEqual(unknown.body);
  });

  it("slows down someone who keeps guessing codes (429)", async () => {
    const { app } = await setupHttp(); // the test limit is 5 per minute
    for (let i = 0; i < 5; i++) {
      expect((await request(app).get("/api/track/CCCC-CCCC-CCCC")).status).toBe(404);
    }
    const blocked = await request(app).get("/api/track/CCCC-CCCC-CCCC");
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});

describe("login", () => {
  it("gives a token for the right email and password", async () => {
    const { app } = await setupHttp();
    const res = await request(app).post("/api/auth/login").send({ email: "officer@example.com", password: "correct-horse-battery-1" });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("answers a wrong password and an unknown email the same way (401)", async () => {
    const { app } = await setupHttp();
    const wrong = await request(app).post("/api/auth/login").send({ email: "officer@example.com", password: "nope" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it("refuses a disabled account (401)", async () => {
    const { app } = await setupHttp();
    const res = await request(app).post("/api/auth/login").send({ email: "disabled@example.com", password: "correct-horse-battery-1" });
    expect(res.status).toBe(401);
  });

  it("refuses missing fields (400)", async () => {
    const { app } = await setupHttp();
    const res = await request(app).post("/api/auth/login").send({ email: "officer@example.com" });
    expect(res.status).toBe(400);
  });

  it("blocks repeated attempts, even with the correct password afterwards (429)", async () => {
    const { app } = await setupHttp(); // the test limit is 5 attempts per minute
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send({ email: "officer@example.com", password: "wrong" });
    }
    const blocked = await request(app).post("/api/auth/login").send({ email: "officer@example.com", password: "correct-horse-battery-1" });
    expect(blocked.status).toBe(429);
  });
});

describe("officer endpoints", () => {
  it("refuses requests without a token or with a fake token (401)", async () => {
    const { app } = await setupHttp();
    expect((await request(app).get("/api/officer/reports")).status).toBe(401);
    const fake = await request(app).get("/api/officer/reports").set(...bearer("fake.token.here"));
    expect(fake.status).toBe(401);
  });

  it("lists reports from the officer's area", async () => {
    const { app, loginAs } = await setupHttp();
    const submitted = await submit(app);
    const token = await loginAs("officer@example.com");
    const res = await request(app).get("/api/officer/reports").set(...bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.reports.map((r: { reference: string }) => r.reference)).toEqual([submitted.body.reference]);
  });

  it("shows an officer from another area an empty list", async () => {
    const { app, loginAs } = await setupHttp();
    await submit(app);
    const token = await loginAs("far@example.com");
    const res = await request(app).get("/api/officer/reports").set(...bearer(token));
    expect(res.body.reports).toEqual([]);
  });

  it("refuses an unknown status filter (400)", async () => {
    const { app, loginAs } = await setupHttp();
    const token = await loginAs("officer@example.com");
    const res = await request(app).get("/api/officer/reports?status=banana").set(...bearer(token));
    expect(res.status).toBe(400);
  });

  it("gives the officer the full report, including contact and coordinates", async () => {
    const { app, loginAs } = await setupHttp();
    const submitted = await submit(app);
    const token = await loginAs("officer@example.com");
    const res = await request(app).get(`/api/officer/reports/${submitted.body.reference}`).set(...bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.contact.phone).toBe("0240000000");
    expect(res.body.latitude).toBe(5.123456);
    expect(res.body.description).toContain("Muddy water");
  });

  it("answers 404 when a valid officer asks for an unknown code", async () => {
    const { app, loginAs } = await setupHttp();
    const token = await loginAs("officer@example.com");
    const res = await request(app).get("/api/officer/reports/CCCC-CCCC-CCCC").set(...bearer(token));
    expect(res.status).toBe(404);
  });

  it("lets the reporter see the status move when an officer starts a review", async () => {
    const { app, loginAs } = await setupHttp();
    const { body } = await submit(app);
    const token = await loginAs("officer@example.com");

    const review = await request(app).post(`/api/officer/reports/${body.reference}/start-review`).set(...bearer(token));
    expect(review.status).toBe(200);
    expect(review.body.status).toBe("under_review");

    const tracked = await request(app).get(`/api/track/${body.reference}`);
    expect(tracked.body.status).toBe("under_review");
    expect(JSON.stringify(tracked.body)).not.toContain("officer-1");
  });

  it("cannot verify a report nobody has reviewed (422)", async () => {
    const { app, loginAs } = await setupHttp();
    const { body } = await submit(app);
    const token = await loginAs("officer@example.com");
    const res = await request(app)
      .post(`/api/officer/reports/${body.reference}/verify`)
      .set(...bearer(token))
      .send({ reason: "Photos match the site" });
    expect(res.status).toBe(422);
  });

  it("verifies after review when a reason is given, and needs that reason", async () => {
    const { app, loginAs } = await setupHttp();
    const { body } = await submit(app);
    const token = await loginAs("officer@example.com");
    await request(app).post(`/api/officer/reports/${body.reference}/start-review`).set(...bearer(token));

    const noReason = await request(app).post(`/api/officer/reports/${body.reference}/verify`).set(...bearer(token)).send({ reason: "" });
    expect(noReason.status).toBe(422);

    const verified = await request(app).post(`/api/officer/reports/${body.reference}/verify`).set(...bearer(token)).send({ reason: "Photos match the site" });
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe("verified");
  });

  it("asks the reporter for more information", async () => {
    const { app, loginAs } = await setupHttp();
    const { body } = await submit(app);
    const token = await loginAs("officer@example.com");
    await request(app).post(`/api/officer/reports/${body.reference}/start-review`).set(...bearer(token));
    const res = await request(app)
      .post(`/api/officer/reports/${body.reference}/request-information`)
      .set(...bearer(token))
      .send({ question: "Which side of the river is the site?" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("more_information_requested");
  });
});

describe("refusals are enforced AND logged over HTTP", () => {
  it("refuses an administrator (403) and logs it", async () => {
    const { app, audit, loginAs } = await setupHttp();
    const token = await loginAs("admin@example.com");
    const res = await request(app).get("/api/officer/reports").set(...bearer(token));
    expect(res.status).toBe(403);
    expect(audit.entries().some((e) => e.actorId === "admin-1" && e.outcome === "denied")).toBe(true);
  });

  it("refuses an officer disabled after getting a token (403) and logs it", async () => {
    const { app, audit, tokens } = await setupHttp();
    const oldToken = tokens.issue("officer-off");
    const res = await request(app).get("/api/officer/reports").set(...bearer(oldToken));
    expect(res.status).toBe(403);
    expect(audit.entries().some((e) => e.actorId === "officer-off" && e.outcome === "denied")).toBe(true);
  });

  it("refuses an officer from another area (403) and logs it", async () => {
    const { app, audit, loginAs } = await setupHttp();
    const { body } = await submit(app);
    const token = await loginAs("far@example.com");
    const res = await request(app).get(`/api/officer/reports/${body.reference}`).set(...bearer(token));
    expect(res.status).toBe(403);
    expect(audit.entries().some((e) => e.actorId === "officer-far" && e.outcome === "denied")).toBe(true);
  });
});

describe("passing on and closing over HTTP", () => {
  async function verifiedReport() {
    const http = await setupHttp();
    const { body } = await submit(http.app);
    const token = await http.loginAs("officer@example.com");
    await request(http.app).post(`/api/officer/reports/${body.reference}/start-review`).set(...bearer(token));
    await request(http.app).post(`/api/officer/reports/${body.reference}/verify`).set(...bearer(token)).send({ reason: "Photos match the site" });
    return { ...http, code: body.reference as string, token };
  }

  it("passes a report on when a note says to whom, and refuses without one", async () => {
    const { app, code, token } = await verifiedReport();
    const missing = await request(app).post(`/api/officer/reports/${code}/refer-for-action`).set(...bearer(token)).send({});
    expect(missing.status).toBe(400);

    const res = await request(app)
      .post(`/api/officer/reports/${code}/refer-for-action`)
      .set(...bearer(token))
      .send({ note: "District Assembly mining task force" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("referred_for_action");
  });

  it("closes with an empty body, and with a note", async () => {
    const { app, code, token } = await verifiedReport();
    const res = await request(app).post(`/api/officer/reports/${code}/close`).set(...bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("closed");

    const again = await request(app).post(`/api/officer/reports/${code}/close`).set(...bearer(token)).send({ note: "Done" });
    expect(again.status).toBe(422); // already closed: no move from closed
  });

  it("needs a login to close", async () => {
    const { app, code } = await verifiedReport();
    const res = await request(app).post(`/api/officer/reports/${code}/close`);
    expect(res.status).toBe(401);
  });
});

describe("cross-origin browser calls", () => {
  it("are refused by default: no CORS headers at all", async () => {
    const { app } = await setupHttp();
    const res = await request(app).get("/api/health").set("Origin", "http://localhost:8081");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("are allowed only for listed origins, including the preflight", async () => {
    const { app } = await setupHttp({ corsOrigins: ["http://localhost:8081"] });

    const preflight = await request(app)
      .options("/api/officer/reports")
      .set("Origin", "http://localhost:8081")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization");
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("http://localhost:8081");
    expect(preflight.headers["access-control-allow-headers"]).toContain("Authorization");

    const other = await request(app).get("/api/health").set("Origin", "https://evil.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("place details", () => {
  it("are shown to officers but never on the public tracking page", async () => {
    const { app, loginAs } = await setupHttp();
    const res = await submit(app, { ...REPORT, placeDetails: "Behind Kofi's farm, near the river bridge" }, "place-details-key-0001");
    expect(res.status).toBe(201);

    const tracked = await request(app).get(`/api/track/${res.body.reference}`);
    expect(tracked.body.area).toBe("Sample Community");
    expect(JSON.stringify(tracked.body)).not.toContain("Kofi");

    const token = await loginAs("officer@example.com");
    const officerView = await request(app).get(`/api/officer/reports/${res.body.reference}`).set(...bearer(token));
    expect(officerView.body.placeDetails).toBe("Behind Kofi's farm, near the river bridge");
  });

  it("refuses place details that are not text", async () => {
    const { app } = await setupHttp();
    const res = await submit(app, { ...REPORT, placeDetails: 42 }, "place-details-key-0002");
    expect(res.status).toBe(400);
  });
});

describe("answering an officer's question from the tracking page", () => {
  async function askedReport() {
    const http = await setupHttp();
    const { body } = await submit(http.app);
    const token = await http.loginAs("officer@example.com");
    await request(http.app).post(`/api/officer/reports/${body.reference}/start-review`).set(...bearer(token));
    await request(http.app)
      .post(`/api/officer/reports/${body.reference}/request-information`)
      .set(...bearer(token))
      .send({ question: "Which side of the river is the site?" });
    return { ...http, code: body.reference as string, token };
  }

  it("shows the question on the tracking page, takes one answer and never shows the answer publicly", async () => {
    const { app, code, token, notifier } = await askedReport();

    const before = await request(app).get(`/api/track/${code}`);
    expect(before.body.question).toMatchObject({ text: "Which side of the river is the site?", answeredAt: null });

    const answered = await request(app).post(`/api/track/${code}/answer`).send({ answer: "The east bank, past Kofi's farm" });
    expect(answered.status).toBe(200);
    expect(answered.body.question.answeredAt).toEqual(expect.any(String));
    expect(JSON.stringify(answered.body)).not.toContain("Kofi");

    const again = await request(app).post(`/api/track/${code}/answer`).send({ answer: "Another answer" });
    expect(again.status).toBe(422);

    const officerView = await request(app).get(`/api/officer/reports/${code}`).set(...bearer(token));
    expect(officerView.body.replies).toEqual([{ answer: "The east bank, past Kofi's farm", at: expect.any(String) }]);
    expect(notifier.answered).toHaveLength(1);
  });

  it("refuses an answer when no question is waiting", async () => {
    const { app } = await setupHttp();
    const { body } = await submit(app);
    const res = await request(app).post(`/api/track/${body.reference}/answer`).send({ answer: "Hello" });
    expect(res.status).toBe(422);
    expect((await request(app).get(`/api/track/${body.reference}`)).body.question).toBeNull();
  });

  it("answers 404 for an unknown or malformed code, the same as tracking", async () => {
    const { app } = await setupHttp();
    expect((await request(app).post("/api/track/ZZZZ-ZZZZ-ZZZZ/answer").send({ answer: "Hello" })).status).toBe(404);
    expect((await request(app).post("/api/track/not-a-code/answer").send({ answer: "Hello" })).status).toBe(404);
  });
});
