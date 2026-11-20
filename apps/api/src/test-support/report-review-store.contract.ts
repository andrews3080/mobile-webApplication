import { describe, it, expect } from "vitest";
import type { ReportRepository } from "../application/ports";
import { Location } from "../domain/location";
import { ReferenceCode } from "../domain/reference-code";
import { aReport, LATER } from "./builders";

// The rules every repository must follow for listing and updating reports.
// Today: in-memory. In Step 4 the very same rules run against PostgreSQL.
export function reportReviewStoreContract(name: string, makeRepo: () => ReportRepository): void {
  const K1 = "key-aaaaaaaaaaaaaaaa";
  const K2 = "key-bbbbbbbbbbbbbbbb";
  const inArea = (area: string) => ({ location: Location.create({ area }) });

  describe(`${name} follows the ReportReviewStore contract`, () => {
    it("lists only reports from the requested areas", async () => {
      const repo = makeRepo();
      await repo.saveIfNew(aReport("AAAA-AAAA-AAAA", inArea("North")), K1);
      await repo.saveIfNew(aReport("BBBB-BBBB-BBBB", inArea("South")), K2);
      const list = await repo.listByAreas(["North"]);
      expect(list.map((r) => r.reference.toString())).toEqual(["AAAA-AAAA-AAAA"]);
    });

    it("matches areas ignoring capital letters and extra spaces", async () => {
      const repo = makeRepo();
      await repo.saveIfNew(aReport("AAAA-AAAA-AAAA", inArea("North")), K1);
      expect(await repo.listByAreas(["  nORTH "])).toHaveLength(1);
    });

    it("lists nothing when no areas are given", async () => {
      const repo = makeRepo();
      await repo.saveIfNew(aReport("AAAA-AAAA-AAAA"), K1);
      expect(await repo.listByAreas([])).toHaveLength(0);
    });

    it("replaces a report when the expected status still matches", async () => {
      const repo = makeRepo();
      const original = aReport("AAAA-AAAA-AAAA");
      await repo.saveIfNew(original, K1);
      const updated = original.transitionTo("under_review", "officer-1", LATER);

      expect(await repo.replace(updated, "received")).toBe(true);
      const found = await repo.findByReference(ReferenceCode.parse("AAAA-AAAA-AAAA"));
      expect(found?.status).toBe("under_review");
    });

    it("keeps a reporter's answer when the report is replaced", async () => {
      const repo = makeRepo();
      const asked = aReport("AAAA-AAAA-AAAA")
        .transitionTo("under_review", "officer-1", LATER)
        .transitionTo("more_information_requested", "officer-1", LATER, "Which side of the river is the site?");
      await repo.saveIfNew(asked, K1);
      const answered = asked.answerQuestion("The east bank, past the bridge", new Date(LATER.getTime() + 60_000));

      expect(await repo.replace(answered, "more_information_requested")).toBe(true);
      const found = await repo.findByReference(ReferenceCode.parse("AAAA-AAAA-AAAA"));
      expect(found?.replies).toEqual(answered.replies);
      expect(found?.openQuestion()?.answeredAt).toEqual(answered.replies[0]?.at);
    });

    it("refuses to replace when someone else changed the report first", async () => {
      const repo = makeRepo();
      const original = aReport("AAAA-AAAA-AAAA");
      await repo.saveIfNew(original, K1);

      const byFirstOfficer = original.transitionTo("under_review", "officer-1", LATER);
      const bySecondOfficer = original.transitionTo("under_review", "officer-2", LATER);

      expect(await repo.replace(byFirstOfficer, "received")).toBe(true);
      expect(await repo.replace(bySecondOfficer, "received")).toBe(false); // stale

      const found = await repo.findByReference(ReferenceCode.parse("AAAA-AAAA-AAAA"));
      expect(found?.history[0]?.officerId).toBe("officer-1"); // first change survived
    });

    it("refuses to replace a report that does not exist", async () => {
      const repo = makeRepo();
      const ghost = aReport("CCCC-CCCC-CCCC").transitionTo("under_review", "officer-1", LATER);
      expect(await repo.replace(ghost, "received")).toBe(false);
    });

    it("answers a late retry with the UPDATED report, not a stale copy", async () => {
      const repo = makeRepo();
      const original = aReport("AAAA-AAAA-AAAA");
      await repo.saveIfNew(original, K1);
      await repo.replace(original.transitionTo("under_review", "officer-1", LATER), "received");

      const retry = await repo.saveIfNew(aReport("BBBB-BBBB-BBBB"), K1);
      expect(retry.created).toBe(false);
      expect(retry.report.status).toBe("under_review");
    });
  });
}
