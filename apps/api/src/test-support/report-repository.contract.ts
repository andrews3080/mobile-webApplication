import { describe, it, expect } from "vitest";
import type { ReportRepository } from "../application/ports";
import { ReferenceCode } from "../domain/reference-code";
import { aReport } from "./builders";

// ONE set of rules that EVERY ReportRepository must obey.
// Today it runs against the in-memory version. In Step 4 the same rules
// run against PostgreSQL. That is the Liskov Substitution Principle in practice.
export function reportRepositoryContract(name: string, makeRepo: () => ReportRepository): void {
  const KEY_A = "key-aaaaaaaaaaaaaaaa";
  const KEY_B = "key-bbbbbbbbbbbbbbbb";

  describe(`${name} follows the ReportRepository contract`, () => {
    it("stores a new report and says it was created", async () => {
      const repo = makeRepo();
      const result = await repo.saveIfNew(aReport("AAAA-AAAA-AAAA"), KEY_A);
      expect(result.created).toBe(true);
    });

    it("returns the ORIGINAL report when the same key is used again", async () => {
      const repo = makeRepo();
      await repo.saveIfNew(aReport("AAAA-AAAA-AAAA"), KEY_A);
      const retry = await repo.saveIfNew(aReport("BBBB-BBBB-BBBB"), KEY_A);
      expect(retry.created).toBe(false);
      expect(retry.report.reference.toString()).toBe("AAAA-AAAA-AAAA");
    });

    it("stores different keys as different reports", async () => {
      const repo = makeRepo();
      const a = await repo.saveIfNew(aReport("AAAA-AAAA-AAAA"), KEY_A);
      const b = await repo.saveIfNew(aReport("BBBB-BBBB-BBBB"), KEY_B);
      expect(a.created).toBe(true);
      expect(b.created).toBe(true);
    });

    it("finds a stored report by its reference code", async () => {
      const repo = makeRepo();
      await repo.saveIfNew(aReport("AAAA-AAAA-AAAA"), KEY_A);
      const found = await repo.findByReference(ReferenceCode.parse("AAAA-AAAA-AAAA"));
      expect(found?.reference.toString()).toBe("AAAA-AAAA-AAAA");
    });

    it("returns null for an unknown reference code", async () => {
      const repo = makeRepo();
      const found = await repo.findByReference(ReferenceCode.parse("CCCC-CCCC-CCCC"));
      expect(found).toBeNull();
    });

    it("creates exactly one report when the same key arrives twice at once (double tap)", async () => {
      const repo = makeRepo();
      const [first, second] = await Promise.all([
        repo.saveIfNew(aReport("AAAA-AAAA-AAAA"), KEY_A),
        repo.saveIfNew(aReport("BBBB-BBBB-BBBB"), KEY_A),
      ]);
      const createdCount = [first, second].filter((r) => r.created).length;
      expect(createdCount).toBe(1);
      expect(first.report.reference.toString()).toBe(second.report.reference.toString());
    });
  });
}
