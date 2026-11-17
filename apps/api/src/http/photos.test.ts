import { describe, it, expect } from "vitest";
import request from "supertest";
import { MAX_PHOTO_BYTES } from "../application/photo-rules";
import { ImageMetadataStripper } from "../infrastructure/image-metadata-stripper";
import { NOW } from "../test-support/builders";
import { aJpeg, aPng, containsText } from "../test-support/fake-images";
import { setupHttp } from "../test-support/http-setup";
import type { TestApp } from "../test-support/http-setup";

const REPORT_KEY = "11111111-2222-3333-4444-555555555555";
const jpegWithGps = aJpeg({ exifSecret: "GPS-5.1234N-0.6543W" });
const cleanJpeg = new ImageMetadataStripper().sanitise(jpegWithGps, "image/jpeg");

function reportBody(photoKeys: string[] = []) {
  return {
    description: "Muddy water and diggers near the river bank",
    category: "river_pollution",
    observedAt: "2026-11-14T08:00:00Z",
    area: "Sample Community",
    contact: { phone: "0240000000" },
    photoKeys,
  };
}

// Asks for a slot and sends the photo, and returns the key to put in the report
async function uploadPhoto(app: TestApp, bytes: Uint8Array = jpegWithGps, type = "image/jpeg"): Promise<string> {
  const slot = await request(app).post("/api/uploads").send({ contentType: type, sizeBytes: bytes.length });
  expect(slot.status).toBe(201);
  const put = await request(app).put(String(slot.body.uploadUrl)).set("Content-Type", type).send(Buffer.from(bytes));
  expect(put.status).toBe(201);
  return String(slot.body.key);
}

function submit(app: TestApp, photoKeys: string[]) {
  return request(app).post("/api/reports").set("Idempotency-Key", REPORT_KEY).send(reportBody(photoKeys));
}

describe("photo upload slots", () => {
  it("gives a signed upload link for a JPEG", async () => {
    const { app } = await setupHttp();
    const res = await request(app).post("/api/uploads").send({ contentType: "image/jpeg", sizeBytes: 50_000 });
    expect(res.status).toBe(201);
    expect(res.body.key).toBe("photos/00000000000000000000000000000001.jpg");
    expect(res.body.uploadUrl).toMatch(/^\/api\/uploads\/[0-9a-f]{32}\.jpg\?expires=\d+&sig=[0-9a-f]{64}$/);
    expect(res.body.maxBytes).toBe(MAX_PHOTO_BYTES);
  });

  it("refuses SVG and other types (400)", async () => {
    const { app } = await setupHttp();
    const res = await request(app).post("/api/uploads").send({ contentType: "image/svg+xml", sizeBytes: 1000 });
    expect(res.status).toBe(400);
  });

  it("refuses a photo that is too big to even start (400)", async () => {
    const { app } = await setupHttp();
    const res = await request(app).post("/api/uploads").send({ contentType: "image/jpeg", sizeBytes: MAX_PHOTO_BYTES + 1 });
    expect(res.status).toBe(400);
  });

  it("refuses a request with no size (400)", async () => {
    const { app } = await setupHttp();
    expect((await request(app).post("/api/uploads").send({ contentType: "image/jpeg" })).status).toBe(400);
  });
});

describe("sending the photo", () => {
  it("stores the photo WITHOUT its hidden location data", async () => {
    const { app, photos } = await setupHttp();
    const key = await uploadPhoto(app);
    const stored = await photos.read(key);
    expect(containsText(jpegWithGps, "GPS-5.1234N")).toBe(true);
    expect(containsText(stored?.bytes ?? new Uint8Array(), "GPS-5.1234N")).toBe(false);
  });

  it("refuses a body over the size limit (413), whatever the slot said", async () => {
    const { app } = await setupHttp();
    const slot = await request(app).post("/api/uploads").send({ contentType: "image/jpeg", sizeBytes: 1000 });
    const res = await request(app)
      .put(String(slot.body.uploadUrl))
      .set("Content-Type", "image/jpeg")
      .send(Buffer.alloc(MAX_PHOTO_BYTES + 1));
    expect(res.status).toBe(413);
  });

  it("refuses a file that is not really an image (400)", async () => {
    const { app, photos } = await setupHttp();
    const slot = await request(app).post("/api/uploads").send({ contentType: "image/jpeg", sizeBytes: 1000 });
    const res = await request(app)
      .put(String(slot.body.uploadUrl))
      .set("Content-Type", "image/jpeg")
      .send(Buffer.from("<svg onload=alert(1)></svg>"));
    expect(res.status).toBe(400);
    expect(photos.count()).toBe(0);
  });

  it("refuses an image of a different type than the slot (400)", async () => {
    const { app } = await setupHttp();
    const slot = await request(app).post("/api/uploads").send({ contentType: "image/png", sizeBytes: 1000 });
    const res = await request(app)
      .put(String(slot.body.uploadUrl))
      .set("Content-Type", "image/png")
      .send(Buffer.from(jpegWithGps));
    expect(res.status).toBe(400);
  });

  it("refuses a send without an image Content-Type (400)", async () => {
    const { app } = await setupHttp();
    const slot = await request(app).post("/api/uploads").send({ contentType: "image/jpeg", sizeBytes: 1000 });
    const res = await request(app).put(String(slot.body.uploadUrl)).set("Content-Type", "text/plain").send("hello");
    expect(res.status).toBe(400);
  });

  it("refuses a tampered signature (403)", async () => {
    const { app, photos } = await setupHttp();
    const slot = await request(app).post("/api/uploads").send({ contentType: "image/jpeg", sizeBytes: 1000 });
    const tampered = String(slot.body.uploadUrl).replace(/.$/, (c) => (c === "0" ? "1" : "0"));
    const res = await request(app).put(tampered).set("Content-Type", "image/jpeg").send(Buffer.from(jpegWithGps));
    expect(res.status).toBe(403);
    expect(photos.count()).toBe(0);
  });

  it("refuses an expired link (403)", async () => {
    const { app, signer } = await setupHttp();
    const id = "c".repeat(32);
    const expired = NOW.getTime() - 1000;
    const signature = signer.sign(`photos/${id}.jpg`, expired);
    const res = await request(app)
      .put(`/api/uploads/${id}.jpg?expires=${expired}&sig=${signature}`)
      .set("Content-Type", "image/jpeg")
      .send(Buffer.from(jpegWithGps));
    expect(res.status).toBe(403);
  });

  it("refuses a link with missing parts (400)", async () => {
    const { app } = await setupHttp();
    const res = await request(app).put(`/api/uploads/${"c".repeat(32)}.jpg`).set("Content-Type", "image/jpeg").send(Buffer.from(jpegWithGps));
    expect(res.status).toBe(400);
  });

  it("refuses to use a link twice (409)", async () => {
    const { app } = await setupHttp();
    const slot = await request(app).post("/api/uploads").send({ contentType: "image/jpeg", sizeBytes: 1000 });
    const url = String(slot.body.uploadUrl);
    expect((await request(app).put(url).set("Content-Type", "image/jpeg").send(Buffer.from(jpegWithGps))).status).toBe(201);
    expect((await request(app).put(url).set("Content-Type", "image/jpeg").send(Buffer.from(jpegWithGps))).status).toBe(409);
  });

  it("accepts a PNG too", async () => {
    const { app } = await setupHttp();
    expect(await uploadPhoto(app, aPng(), "image/png")).toMatch(/\.png$/);
  });
});

describe("photos on reports", () => {
  it("lets a reporter attach photos, and the officer view the cleaned photo", async () => {
    const { app, loginAs } = await setupHttp();
    const photoKey = await uploadPhoto(app);
    const submitted = await submit(app, [photoKey]);
    expect(submitted.status).toBe(201);
    const reference = String(submitted.body.reference);

    const token = await loginAs("officer@example.com");
    const detail = await request(app).get(`/api/officer/reports/${reference}`).set("Authorization", `Bearer ${token}`);
    expect(detail.body.photoKeys).toEqual([photoKey]);

    const file = photoKey.slice("photos/".length);
    const photo = await request(app).get(`/api/officer/reports/${reference}/photos/${file}`).set("Authorization", `Bearer ${token}`);
    expect(photo.status).toBe(200);
    expect(photo.headers["content-type"]).toContain("image/jpeg");
    expect(photo.headers["x-content-type-options"]).toBe("nosniff");
    expect(photo.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(Buffer.isBuffer(photo.body)).toBe(true);
    expect(Buffer.from(photo.body).equals(Buffer.from(cleanJpeg))).toBe(true); // the CLEAN version
    expect(containsText(photo.body, "GPS-5.1234N")).toBe(false);
  });

  it("refuses a report that mentions a photo that was never uploaded (400)", async () => {
    const { app, repo } = await setupHttp();
    const res = await submit(app, [`photos/${"d".repeat(32)}.jpg`]);
    expect(res.status).toBe(400);
    expect(repo.count()).toBe(0);
  });

  it("refuses a photo key in the wrong format (400)", async () => {
    const { app } = await setupHttp();
    expect((await submit(app, ["https://evil.example/x.jpg"])).status).toBe(400);
  });

  it("shows the public tracking page only the NUMBER of photos", async () => {
    const { app } = await setupHttp();
    const photoKey = await uploadPhoto(app);
    const submitted = await submit(app, [photoKey]);
    const tracked = await request(app).get(`/api/track/${submitted.body.reference}`);
    expect(tracked.body.photoCount).toBe(1);
    expect(JSON.stringify(tracked.body)).not.toContain(photoKey.slice("photos/".length, -4));
  });

  it("refuses photo viewing without a login (401)", async () => {
    const { app } = await setupHttp();
    const photoKey = await uploadPhoto(app);
    const submitted = await submit(app, [photoKey]);
    const res = await request(app).get(`/api/officer/reports/${submitted.body.reference}/photos/${photoKey.slice(7)}`);
    expect(res.status).toBe(401);
  });

  it("refuses an officer from another area (403) and logs it", async () => {
    const { app, audit, loginAs } = await setupHttp();
    const photoKey = await uploadPhoto(app);
    const submitted = await submit(app, [photoKey]);
    const token = await loginAs("far@example.com");
    const res = await request(app)
      .get(`/api/officer/reports/${submitted.body.reference}/photos/${photoKey.slice(7)}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(audit.entries().some((e) => e.actorId === "officer-far" && e.action === "photo.view" && e.outcome === "denied")).toBe(true);
  });

  it("will not serve a photo through a report it does not belong to (404)", async () => {
    const { app, loginAs } = await setupHttp();
    const photoOne = await uploadPhoto(app);
    const photoTwo = await uploadPhoto(app);
    const submitted = await submit(app, [photoOne]); // report has photo ONE only
    const token = await loginAs("officer@example.com");
    const res = await request(app)
      .get(`/api/officer/reports/${submitted.body.reference}/photos/${photoTwo.slice(7)}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
