import { describe, it, expect } from "vitest";
import { ScryptPasswordHasher } from "./scrypt-password-hasher";

describe("ScryptPasswordHasher", () => {
  const hasher = new ScryptPasswordHasher();

  it("accepts the right password", async () => {
    const hash = await hasher.hash("my-secret-pass");
    expect(await hasher.verify("my-secret-pass", hash)).toBe(true);
  });

  it("refuses a wrong password", async () => {
    const hash = await hasher.hash("my-secret-pass");
    expect(await hasher.verify("my-secret-pasx", hash)).toBe(false);
  });

  it("never stores the password itself", async () => {
    const hash = await hasher.hash("my-secret-pass");
    expect(hash).not.toContain("my-secret-pass");
  });

  it("gives different hashes for the same password (random salt)", async () => {
    const a = await hasher.hash("my-secret-pass");
    const b = await hasher.hash("my-secret-pass");
    expect(a).not.toBe(b);
  });

  it("refuses an empty or broken stored hash without crashing", async () => {
    expect(await hasher.verify("anything", "")).toBe(false);
    expect(await hasher.verify("anything", "not-a-hash")).toBe(false);
    expect(await hasher.verify("anything", "scrypt$zz$zz")).toBe(false);
  });
});
