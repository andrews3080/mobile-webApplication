import { describe, it, expect } from "vitest";
import { buildPhotoKey, detectImageType, imageTypeOfPhotoKey, isPhotoKey, toImageType } from "./image-type";
import { DomainError } from "./errors";
import { aJpeg, aPng, aWebp } from "../test-support/fake-images";

describe("image types", () => {
  it("accepts only JPEG, PNG and WebP (never SVG)", () => {
    expect(toImageType("image/jpeg")).toBe("image/jpeg");
    expect(toImageType("image/png")).toBe("image/png");
    expect(toImageType("image/webp")).toBe("image/webp");
    expect(toImageType("image/svg+xml")).toBeNull();
    expect(toImageType("image/gif")).toBeNull();
    expect(toImageType("application/pdf")).toBeNull();
    expect(toImageType(undefined)).toBeNull();
  });

  it("recognises each format by its first bytes", () => {
    expect(detectImageType(aJpeg())).toBe("image/jpeg");
    expect(detectImageType(aPng())).toBe("image/png");
    expect(detectImageType(aWebp())).toBe("image/webp");
  });

  it("is not fooled by text, SVG, or an empty file", () => {
    expect(detectImageType(Uint8Array.from([...'<svg xmlns="x"></svg>'].map((c) => c.charCodeAt(0))))).toBeNull();
    expect(detectImageType(new Uint8Array(0))).toBeNull();
    expect(detectImageType(Uint8Array.from([0xff, 0xd8]))).toBeNull(); // too short to be a JPEG
  });
});

describe("photo keys", () => {
  const id = "0123456789abcdef0123456789abcdef";

  it("builds and recognises a key", () => {
    const key = buildPhotoKey(id, "image/png");
    expect(key).toBe(`photos/${id}.png`);
    expect(isPhotoKey(key)).toBe(true);
    expect(imageTypeOfPhotoKey(key)).toBe("image/png");
  });

  it("refuses an id that is not 32 hex characters", () => {
    expect(() => buildPhotoKey("short", "image/png")).toThrow(DomainError);
    expect(() => buildPhotoKey("../../etc/passwd", "image/png")).toThrow(DomainError);
  });

  it("rejects anything that is not exactly our format", () => {
    for (const bad of [
      "",
      "photos/abc.jpg",
      `photos/${id}.gif`,
      `photos/${id}.JPG`,
      `photos/../${id}.jpg`,
      `/photos/${id}.jpg`,
      `photos/${id}.jpg/extra`,
      `photos\\${id}.jpg`,
    ]) {
      expect(isPhotoKey(bad)).toBe(false);
    }
  });
});
