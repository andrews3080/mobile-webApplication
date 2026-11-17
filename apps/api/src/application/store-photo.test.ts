import { describe, it, expect } from "vitest";
import { CreateUploadSlot } from "./create-upload-slot";
import type { UploadSlot } from "./create-upload-slot";
import { ConflictError, ForbiddenError, InvalidRequestError } from "./errors";
import { MAX_PHOTO_BYTES, SLOT_LIFETIME_MS } from "./photo-rules";
import { StorePhoto } from "./store-photo";
import { DomainError } from "../domain/errors";
import { containsText, aJpeg, aPng } from "../test-support/fake-images";
import { makePhotoParts } from "../test-support/photo-parts";
import { MutableClock } from "../test-support/mutable-clock";

function setup() {
  const clock = new MutableClock();
  const parts = makePhotoParts();
  const slots = new CreateUploadSlot(parts.ids, parts.signer, clock);
  const store = new StorePhoto(parts.signer, parts.sanitiser, parts.photos, clock);
  return { clock, parts, slots, store };
}
type Setup = ReturnType<typeof setup>;

const slotOf = (s: Setup, type = "image/jpeg") => s.slots.execute({ contentType: type, sizeBytes: 1000 });

function upload(s: Setup, slot: UploadSlot, bytes: Uint8Array, declaredType: string | undefined = slot.contentType) {
  return s.store.execute({ key: slot.key, expiresAtMs: slot.expiresAtMs, signature: slot.signature, declaredType, bytes });
}

describe("StorePhoto", () => {
  it("stores the photo WITHOUT its hidden location data", async () => {
    const s = setup();
    const slot = await slotOf(s);
    await upload(s, slot, aJpeg({ exifSecret: "GPS-5.1234N-0.6543W" }));

    const stored = await s.parts.photos.read(slot.key);
    expect(stored?.contentType).toBe("image/jpeg");
    expect(containsText(stored?.bytes ?? new Uint8Array(), "GPS-5.1234N")).toBe(false);
  });

  it("works for PNG too", async () => {
    const s = setup();
    const slot = await slotOf(s, "image/png");
    await upload(s, slot, aPng({ textSecret: "owner-secret" }));
    expect(containsText((await s.parts.photos.read(slot.key))?.bytes ?? new Uint8Array(), "owner-secret")).toBe(false);
  });

  it("refuses an expired link and stores nothing", async () => {
    const s = setup();
    const slot = await slotOf(s);
    s.clock.advance(SLOT_LIFETIME_MS + 1000);
    await expect(upload(s, slot, aJpeg())).rejects.toThrow(ForbiddenError);
    expect(s.parts.photos.count()).toBe(0);
  });

  it("refuses a forged signature", async () => {
    const s = setup();
    const slot = await slotOf(s);
    await expect(upload(s, { ...slot, signature: "0".repeat(64) }, aJpeg())).rejects.toThrow(ForbiddenError);
  });

  it("refuses a link whose expiry was stretched", async () => {
    const s = setup();
    const slot = await slotOf(s);
    s.clock.advance(SLOT_LIFETIME_MS + 1000);
    await expect(upload(s, { ...slot, expiresAtMs: slot.expiresAtMs + 3_600_000 }, aJpeg())).rejects.toThrow(ForbiddenError);
  });

  it("refuses a key that is not one of ours, even with a valid signature for it", async () => {
    const s = setup();
    const slot = await slotOf(s);
    const evilKey = "photos/../../secret.jpg";
    const signature = s.parts.signer.sign(evilKey, slot.expiresAtMs);
    await expect(
      s.store.execute({ key: evilKey, expiresAtMs: slot.expiresAtMs, signature, declaredType: "image/jpeg", bytes: aJpeg() }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses a file whose label does not match the slot", async () => {
    const s = setup();
    const slot = await slotOf(s);
    await expect(upload(s, slot, aJpeg(), "image/png")).rejects.toThrow(InvalidRequestError);
    expect(s.parts.photos.count()).toBe(0);
  });

  it("refuses a PNG sent into a JPEG slot", async () => {
    const s = setup();
    const slot = await slotOf(s);
    await expect(upload(s, slot, aPng())).rejects.toThrow(InvalidRequestError);
  });

  it("refuses a script disguised as a JPEG", async () => {
    const s = setup();
    const slot = await slotOf(s);
    const script = Uint8Array.from([..."<svg onload=alert(1)>"].map((c) => c.charCodeAt(0)));
    await expect(upload(s, slot, script)).rejects.toThrow(InvalidRequestError);
  });

  it("refuses an empty file and an oversized file", async () => {
    const s = setup();
    const slot = await slotOf(s);
    await expect(upload(s, slot, new Uint8Array(0))).rejects.toThrow(InvalidRequestError);
    await expect(upload(s, slot, new Uint8Array(MAX_PHOTO_BYTES + 1))).rejects.toThrow(InvalidRequestError);
  });

  it("refuses a damaged image", async () => {
    const s = setup();
    const slot = await slotOf(s);
    await expect(upload(s, slot, Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).rejects.toThrow(DomainError);
    expect(s.parts.photos.count()).toBe(0);
  });

  it("refuses to use the same slot twice and keeps the first photo", async () => {
    const s = setup();
    const slot = await slotOf(s);
    await upload(s, slot, aJpeg());
    await expect(upload(s, slot, aJpeg({ comment: "second" }))).rejects.toThrow(ConflictError);
    expect(s.parts.photos.count()).toBe(1);
  });
});
