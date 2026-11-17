import { describe, it, expect } from "vitest";
import { CreateUploadSlot } from "./create-upload-slot";
import { InvalidRequestError } from "./errors";
import { MAX_PHOTO_BYTES, SLOT_LIFETIME_MS } from "./photo-rules";
import { FixedClock, NOW } from "../test-support/builders";
import { makePhotoParts } from "../test-support/photo-parts";

function setup() {
  const parts = makePhotoParts();
  return { parts, slots: new CreateUploadSlot(parts.ids, parts.signer, new FixedClock()) };
}

describe("CreateUploadSlot", () => {
  it("gives a key with the right extension, and a signature that checks out", async () => {
    const { parts, slots } = setup();
    const slot = await slots.execute({ contentType: "image/png", sizeBytes: 1000 });
    expect(slot.key).toBe("photos/00000000000000000000000000000001.png");
    expect(slot.contentType).toBe("image/png");
    expect(slot.maxBytes).toBe(MAX_PHOTO_BYTES);
    expect(parts.signer.verify(slot.key, slot.expiresAtMs, slot.signature)).toBe(true);
  });

  it("makes the slot expire after the agreed lifetime", async () => {
    const { slots } = setup();
    const slot = await slots.execute({ contentType: "image/jpeg", sizeBytes: 1000 });
    expect(slot.expiresAtMs).toBe(NOW.getTime() + SLOT_LIFETIME_MS);
  });

  it("gives every slot a different key", async () => {
    const { slots } = setup();
    const a = await slots.execute({ contentType: "image/jpeg", sizeBytes: 1000 });
    const b = await slots.execute({ contentType: "image/jpeg", sizeBytes: 1000 });
    expect(a.key).not.toBe(b.key);
  });

  it("refuses types that are not JPEG, PNG or WebP (SVG can hide scripts)", async () => {
    const { slots } = setup();
    for (const contentType of ["image/svg+xml", "image/gif", "application/pdf", "text/html", ""]) {
      await expect(slots.execute({ contentType, sizeBytes: 1000 })).rejects.toThrow(InvalidRequestError);
    }
  });

  it("refuses sizes that make no sense", async () => {
    const { slots } = setup();
    for (const sizeBytes of [0, -5, 1.5, Number.NaN]) {
      await expect(slots.execute({ contentType: "image/jpeg", sizeBytes })).rejects.toThrow(InvalidRequestError);
    }
  });

  it("allows exactly the maximum size but not one byte more", async () => {
    const { slots } = setup();
    await expect(slots.execute({ contentType: "image/jpeg", sizeBytes: MAX_PHOTO_BYTES })).resolves.toBeDefined();
    await expect(slots.execute({ contentType: "image/jpeg", sizeBytes: MAX_PHOTO_BYTES + 1 })).rejects.toThrow(InvalidRequestError);
  });
});
