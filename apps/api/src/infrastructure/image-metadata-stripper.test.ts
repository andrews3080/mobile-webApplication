import { describe, it, expect } from "vitest";
import { ImageMetadataStripper } from "./image-metadata-stripper";
import { DomainError } from "../domain/errors";
import { detectImageType } from "../domain/image-type";
import { aJpeg, aPng, aWebp, containsText } from "../test-support/fake-images";

const stripper = new ImageMetadataStripper();

describe("JPEG cleaning", () => {
  const dirty = aJpeg({ exifSecret: "GPS-5.1234N-0.6543W", comment: "taken by Kwame", trailing: "HIDDEN-TAIL" });
  const clean = stripper.sanitise(dirty, "image/jpeg");

  it("removes location data, comments and anything hidden after the picture", () => {
    expect(containsText(dirty, "GPS-5.1234N")).toBe(true); // the secret really was there
    expect(containsText(clean, "GPS-5.1234N")).toBe(false);
    expect(containsText(clean, "Exif")).toBe(false);
    expect(containsText(clean, "Kwame")).toBe(false);
    expect(containsText(clean, "HIDDEN-TAIL")).toBe(false);
  });

  it("keeps what is needed to show the picture", () => {
    expect(containsText(clean, "JFIF")).toBe(true);
    expect(detectImageType(clean)).toBe("image/jpeg");
    expect(clean.at(-1)).toBe(0xd9); // still ends properly
    expect(clean.length).toBeLessThan(dirty.length);
  });

  it("changes nothing in a photo that is already clean", () => {
    const already = aJpeg();
    expect(Array.from(stripper.sanitise(already, "image/jpeg"))).toEqual(Array.from(already));
  });

  it("gives the same result when cleaned twice", () => {
    expect(Array.from(stripper.sanitise(clean, "image/jpeg"))).toEqual(Array.from(clean));
  });

  it("refuses damaged files", () => {
    expect(() => stripper.sanitise(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toThrow(DomainError);
    expect(() => stripper.sanitise(aJpeg().slice(0, -2), "image/jpeg")).toThrow(DomainError); // no end marker
    expect(() => stripper.sanitise(Uint8Array.from([1, 2, 3]), "image/jpeg")).toThrow(DomainError);
  });
});

describe("PNG cleaning", () => {
  const dirty = aPng({ textSecret: "owner=Kwame-GPS-5.12", exifSecret: "EXIF-SECRET-DATA", trailing: "HIDDEN-TAIL" });
  const clean = stripper.sanitise(dirty, "image/png");

  it("removes text, EXIF and anything hidden after the end", () => {
    expect(containsText(dirty, "Kwame-GPS")).toBe(true);
    expect(containsText(clean, "Kwame-GPS")).toBe(false);
    expect(containsText(clean, "tEXt")).toBe(false);
    expect(containsText(clean, "EXIF-SECRET")).toBe(false);
    expect(containsText(clean, "eXIf")).toBe(false);
    expect(containsText(clean, "HIDDEN-TAIL")).toBe(false);
  });

  it("keeps the picture chunks", () => {
    expect(containsText(clean, "IHDR")).toBe(true);
    expect(containsText(clean, "IDAT")).toBe(true);
    expect(containsText(clean, "IEND")).toBe(true);
    expect(detectImageType(clean)).toBe("image/png");
  });

  it("gives the same result when cleaned twice", () => {
    expect(Array.from(stripper.sanitise(clean, "image/png"))).toEqual(Array.from(clean));
  });

  it("refuses damaged files", () => {
    expect(() => stripper.sanitise(aPng().slice(0, 30), "image/png")).toThrow(DomainError); // cut short
    expect(() => stripper.sanitise(aPng().slice(0, -12), "image/png")).toThrow(DomainError); // no IEND
    expect(() => stripper.sanitise(Uint8Array.from([1, 2, 3]), "image/png")).toThrow(DomainError);
  });
});

describe("WebP cleaning", () => {
  const dirty = aWebp({ exif: "EXIF-GPS-5.1234", xmp: "XMP-OWNER-Kwame" });
  const clean = stripper.sanitise(dirty, "image/webp");

  it("removes EXIF and XMP data", () => {
    expect(containsText(dirty, "EXIF-GPS")).toBe(true);
    expect(containsText(clean, "EXIF-GPS")).toBe(false);
    expect(containsText(clean, "XMP-OWNER")).toBe(false);
    expect(containsText(clean, "EXIF")).toBe(false);
  });

  it("keeps the picture and fixes the header", () => {
    expect(containsText(clean, "VP8 ")).toBe(true);
    expect(detectImageType(clean)).toBe("image/webp");
    expect(clean[20]! & 0x0c).toBe(0); // the EXIF and XMP flags are cleared
    const declaredSize = clean[4]! + clean[5]! * 256 + clean[6]! * 65536 + clean[7]! * 16777216;
    expect(declaredSize).toBe(clean.length - 8); // the file size inside the header is correct
  });

  it("gives the same result when cleaned twice", () => {
    expect(Array.from(stripper.sanitise(clean, "image/webp"))).toEqual(Array.from(clean));
  });

  it("refuses damaged files", () => {
    expect(() => stripper.sanitise(aWebp().slice(0, 20), "image/webp")).toThrow(DomainError);
    expect(() => stripper.sanitise(Uint8Array.from([1, 2, 3]), "image/webp")).toThrow(DomainError);
  });
});
