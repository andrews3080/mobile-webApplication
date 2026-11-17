import { describe, it, expect } from "vitest";
import { HmacUploadSigner } from "./hmac-upload-signer";

const SECRET = "test-upload-secret-0123456789-0123456789";
const KEY = `photos/${"a".repeat(32)}.jpg`;

describe("HmacUploadSigner", () => {
  const signer = new HmacUploadSigner(SECRET);

  it("accepts a signature it made", () => {
    expect(signer.verify(KEY, 1_800_000_000_000, signer.sign(KEY, 1_800_000_000_000))).toBe(true);
  });

  it("refuses the signature for a different key or a different expiry", () => {
    const signature = signer.sign(KEY, 1_800_000_000_000);
    expect(signer.verify(`photos/${"b".repeat(32)}.jpg`, 1_800_000_000_000, signature)).toBe(false);
    expect(signer.verify(KEY, 1_800_000_000_001, signature)).toBe(false); // nobody can extend the link
  });

  it("refuses signatures made with another secret", () => {
    const other = new HmacUploadSigner("another-upload-secret-0123456789-abcdef");
    expect(signer.verify(KEY, 1_800_000_000_000, other.sign(KEY, 1_800_000_000_000))).toBe(false);
  });

  it("refuses garbage of any length without crashing", () => {
    for (const bad of ["", "abc", "zz", "0".repeat(200)]) {
      expect(signer.verify(KEY, 1_800_000_000_000, bad)).toBe(false);
    }
  });

  it("refuses to start with a short secret", () => {
    expect(() => new HmacUploadSigner("short")).toThrow();
  });
});
