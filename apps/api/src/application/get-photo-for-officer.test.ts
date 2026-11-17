import { describe, it, expect } from "vitest";
import { AccessGate } from "./access-gate";
import { AccessPolicy } from "./access-policy";
import { ForbiddenError, NotFoundError } from "./errors";
import { GetPhotoForOfficer } from "./get-photo-for-officer";
import { InMemoryAuditLog } from "../infrastructure/in-memory-audit-log";
import { InMemoryPhotoStore } from "../infrastructure/in-memory-photo-store";
import { InMemoryReportRepository } from "../infrastructure/in-memory-report-repository";
import { aReport, FixedClock } from "../test-support/builders";
import { anAdmin, anOfficer } from "../test-support/actors";
import { aJpeg } from "../test-support/fake-images";

const CODE = "ABCD-EFGH-JKMN";
const FILE = `${"a".repeat(32)}.jpg`;
const OTHER_FILE = `${"b".repeat(32)}.jpg`;

async function setup() {
  const repo = new InMemoryReportRepository();
  const audit = new InMemoryAuditLog();
  const photos = new InMemoryPhotoStore();
  const clock = new FixedClock();
  const gate = new AccessGate(new AccessPolicy(), audit, clock);

  await photos.putIfAbsent(`photos/${FILE}`, aJpeg());
  await photos.putIfAbsent(`photos/${OTHER_FILE}`, aJpeg()); // exists, but belongs to no report
  await repo.saveIfNew(aReport(CODE, { photoKeys: [`photos/${FILE}`] }), "key-aaaaaaaaaaaaaaaa");

  return { audit, photos, get: new GetPhotoForOfficer(repo, gate, photos) };
}

describe("GetPhotoForOfficer", () => {
  it("gives an officer in the right area the photo and logs the view", async () => {
    const s = await setup();
    const photo = await s.get.execute(anOfficer(), CODE, FILE);
    expect(photo.contentType).toBe("image/jpeg");
    expect(photo.bytes.length).toBeGreaterThan(0);
    expect(s.audit.entries()[0]?.action).toBe("photo.view");
    expect(s.audit.entries()[0]?.outcome).toBe("allowed");
  });

  it("refuses an officer from another area, and logs the refusal", async () => {
    const s = await setup();
    await expect(s.get.execute(anOfficer({ areas: ["Other District"] }), CODE, FILE)).rejects.toThrow(ForbiddenError);
    expect(s.audit.entries()[0]?.outcome).toBe("denied");
  });

  it("refuses an administrator", async () => {
    const s = await setup();
    await expect(s.get.execute(anAdmin(), CODE, FILE)).rejects.toThrow(ForbiddenError);
  });

  it("will not serve a photo that belongs to no report, even if it exists", async () => {
    const s = await setup();
    await expect(s.get.execute(anOfficer(), CODE, OTHER_FILE)).rejects.toThrow(NotFoundError);
  });

  it("will not follow path tricks in the file name", async () => {
    const s = await setup();
    await expect(s.get.execute(anOfficer(), CODE, "../../secret.jpg")).rejects.toThrow(NotFoundError);
  });

  it("says not found for an unknown report code", async () => {
    const s = await setup();
    await expect(s.get.execute(anOfficer(), "CCCC-CCCC-CCCC", FILE)).rejects.toThrow(NotFoundError);
  });
});
