import { describe, it, expect } from "vitest";
import { Report, NewReportInput } from "./report";
import { Location } from "./location";
import { ReferenceCode } from "./reference-code";
import { DomainError } from "./errors";

const NOW = new Date("2026-11-14T10:00:00Z");
const LATER = new Date("2026-11-14T11:00:00Z");

// A valid report we can tweak in each test
function validInput(overrides: Partial<NewReportInput> = {}): NewReportInput {
  return {
    reference: ReferenceCode.parse("ABCD-EFGH-JKMN"),
    description: "Muddy water and diggers near the river bank",
    category: "river_pollution",
    observedAt: new Date("2026-11-14T08:00:00Z"),
    location: Location.create({ area: "Sample Community" }),
    ...overrides,
  };
}

describe("Report creation", () => {
  it("starts as received with an empty history", () => {
    const report = Report.create(validInput(), NOW);
    expect(report.status).toBe("received");
    expect(report.history).toHaveLength(0);
  });

  it("rejects a very short description", () => {
    expect(() => Report.create(validInput({ description: "mining" }), NOW)).toThrow(DomainError);
  });

  it("rejects an unknown category", () => {
    expect(() => Report.create(validInput({ category: "nonsense" }), NOW)).toThrow(DomainError);
  });

  it("rejects an observation date in the future", () => {
    const future = new Date("2026-11-15T10:00:00Z");
    expect(() => Report.create(validInput({ observedAt: future }), NOW)).toThrow(DomainError);
  });

  it("tolerates a phone clock a couple of minutes ahead", () => {
    const slightlyAhead = new Date(NOW.getTime() + 2 * 60 * 1000);
    expect(() => Report.create(validInput({ observedAt: slightlyAhead }), NOW)).not.toThrow();
  });

  it("rejects more than 5 photos", () => {
    const photos = ["a", "b", "c", "d", "e", "f"];
    expect(() => Report.create(validInput({ photoKeys: photos }), NOW)).toThrow(DomainError);
  });

  it("treats an empty contact form as no contact", () => {
    const report = Report.create(validInput({ contact: { name: " ", phone: "", email: "" } }), NOW);
    expect(report.contact).toBeUndefined();
  });

  it("rejects a bad email", () => {
    expect(() => Report.create(validInput({ contact: { email: "not-an-email" } }), NOW)).toThrow(DomainError);
  });
});

describe("Report status changes", () => {
  it("records who changed the status, when and why", () => {
    const report = Report.create(validInput(), NOW).transitionTo("under_review", "officer-1", LATER);
    expect(report.status).toBe("under_review");
    expect(report.history).toHaveLength(1);
    expect(report.history[0]?.officerId).toBe("officer-1");
  });

  it("rejects an illegal jump", () => {
    const report = Report.create(validInput(), NOW);
    expect(() => report.transitionTo("verified", "officer-1", LATER, "Looks real")).toThrow(DomainError);
  });

  it("requires a reason to verify", () => {
    const review = Report.create(validInput(), NOW).transitionTo("under_review", "officer-1", LATER);
    expect(() => review.transitionTo("verified", "officer-1", LATER)).toThrow(DomainError);
  });

  it("requires a reason to reject", () => {
    const review = Report.create(validInput(), NOW).transitionTo("under_review", "officer-1", LATER);
    expect(() => review.transitionTo("rejected", "officer-1", LATER, "no")).toThrow(DomainError);
  });

  it("requires an officer for every change", () => {
    const report = Report.create(validInput(), NOW);
    expect(() => report.transitionTo("under_review", " ", LATER)).toThrow(DomainError);
  });

  it("does not change the original report (immutability)", () => {
    const original = Report.create(validInput(), NOW);
    original.transitionTo("under_review", "officer-1", LATER);
    expect(original.status).toBe("received");
  });

  it("walks the full happy path to closed", () => {
    const closed = Report.create(validInput(), NOW)
      .transitionTo("under_review", "officer-1", LATER)
      .transitionTo("verified", "officer-1", LATER, "Photos match the location")
      .transitionTo("closed", "officer-1", LATER);
    expect(closed.status).toBe("closed");
    expect(closed.history).toHaveLength(3);
  });
});
