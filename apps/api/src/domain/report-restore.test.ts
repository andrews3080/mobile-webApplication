import { describe, it, expect } from "vitest";
import { Report } from "./report";
import type { ReportSnapshot } from "./report";
import { DomainError } from "./errors";
import { LATER, NOW } from "../test-support/builders";

const snapshot: ReportSnapshot = {
  reference: "ABCD-EFGH-JKMN",
  description: "Muddy water and diggers near the river bank",
  category: "river_pollution",
  observedAt: NOW,
  createdAt: NOW,
  area: "Sample Community",
  photoKeys: ["photos/a.jpg"],
  status: "under_review",
  history: [{ from: "received", to: "under_review", officerId: "officer-1", at: LATER }],
};

describe("Report.restore", () => {
  it("rebuilds a saved report with its status and history", () => {
    const report = Report.restore(snapshot);
    expect(report.status).toBe("under_review");
    expect(report.history).toHaveLength(1);
    expect(report.reference.toString()).toBe("ABCD-EFGH-JKMN");
  });

  it("gives back a report that still follows the status rules", () => {
    const report = Report.restore(snapshot);
    expect(() => report.transitionTo("closed", "officer-1", LATER)).toThrow(DomainError);
    expect(report.transitionTo("verified", "officer-1", LATER, "Photos match the site").status).toBe("verified");
  });

  it("refuses stored data it cannot understand", () => {
    expect(() => Report.restore({ ...snapshot, category: "nonsense" })).toThrow(DomainError);
    expect(() => Report.restore({ ...snapshot, reference: "bad" })).toThrow(DomainError);
  });
});
