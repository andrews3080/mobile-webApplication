import { describe, it, expect } from "vitest";
import { Location } from "../domain/location";
import { aReport, LATER } from "../test-support/builders";
import { anOfficer } from "../test-support/actors";
import { CODE, setupReview } from "../test-support/review-setup";

describe("ListReportsForOfficer", () => {
  it("shows only reports from the officer's areas, newest first", async () => {
    const s = await setupReview(); // already holds ABCD-EFGH-JKMN, created at NOW
    await s.repo.saveIfNew(aReport("BBBB-BBBB-BBBB", {}, LATER), "key-bbbbbbbbbbbbbbbb");
    await s.repo.saveIfNew(
      aReport("CCCC-CCCC-CCCC", { location: Location.create({ area: "Other District" }) }),
      "key-cccccccccccccccc",
    );

    const list = await s.list.execute(anOfficer());
    expect(list.map((r) => r.reference)).toEqual(["BBBB-BBBB-BBBB", "ABCD-EFGH-JKMN"]);
  });

  it("can filter by status", async () => {
    const s = await setupReview();
    await s.repo.saveIfNew(aReport("BBBB-BBBB-BBBB", {}, LATER), "key-bbbbbbbbbbbbbbbb");
    await s.start.execute(anOfficer(), CODE); // first report moves to under_review

    const received = await s.list.execute(anOfficer(), { status: "received" });
    expect(received.map((r) => r.reference)).toEqual(["BBBB-BBBB-BBBB"]);
    const underReview = await s.list.execute(anOfficer(), { status: "under_review" });
    expect(underReview.map((r) => r.reference)).toEqual([CODE]);
  });

  it("shows summaries only, without descriptions or contact details", async () => {
    const s = await setupReview();
    const list = await s.list.execute(anOfficer());
    expect(Object.keys(list[0] ?? {}).sort()).toEqual(["area", "category", "reference", "status", "submittedAt"]);
  });

  it("gives an officer with no areas an empty list", async () => {
    const s = await setupReview();
    expect(await s.list.execute(anOfficer({ areas: [] }))).toEqual([]);
  });

  it("writes one audit entry for the listing", async () => {
    const s = await setupReview();
    await s.list.execute(anOfficer());
    expect(s.audit.entries()).toHaveLength(1);
    expect(s.audit.entries()[0]?.action).toBe("reports.list");
  });
});

describe("GetReportForOfficer", () => {
  it("gives an officer in the area the full report, including contact details", async () => {
    const s = await setupReview();
    await s.repo.saveIfNew(
      aReport("DDDD-DDDD-DDDD", { contact: { phone: "0240000000" } }),
      "key-dddddddddddddddd",
    );
    const report = await s.get.execute(anOfficer(), "DDDD-DDDD-DDDD");
    expect(report.contact?.phone).toBe("0240000000");
  });

  it("writes an audit entry for every view", async () => {
    const s = await setupReview();
    await s.get.execute(anOfficer(), CODE);
    const entry = s.audit.entries()[0];
    expect(entry?.action).toBe("report.view");
    expect(entry?.outcome).toBe("allowed");
  });
});
