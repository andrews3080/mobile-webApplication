import { describe, it, expect } from "vitest";
import { AccessPolicy } from "./access-policy";
import { aReport } from "../test-support/builders";
import { anAdmin, anOfficer } from "../test-support/actors";

const policy = new AccessPolicy();
const report = aReport(); // lives in "Sample Community"

describe("AccessPolicy", () => {
  it("lets an active officer work with reports in their area", () => {
    expect(policy.canAccessReport(anOfficer(), report).allowed).toBe(true);
  });

  it("ignores capital letters and extra spaces when matching areas", () => {
    const officer = anOfficer({ areas: ["  sample   COMMUNITY "] });
    expect(policy.canAccessReport(officer, report).allowed).toBe(true);
  });

  it("refuses an officer assigned to a different area", () => {
    expect(policy.canAccessReport(anOfficer({ areas: ["Other District"] }), report).allowed).toBe(false);
  });

  it("refuses an officer with no areas", () => {
    expect(policy.canAccessReport(anOfficer({ areas: [] }), report).allowed).toBe(false);
  });

  it("refuses a disabled officer", () => {
    expect(policy.canAccessReport(anOfficer({ active: false }), report).allowed).toBe(false);
  });

  it("refuses an administrator (admins manage accounts, not reports)", () => {
    expect(policy.canAccessReport(anAdmin(), report).allowed).toBe(false);
  });

  it("gives a reason for every refusal, for the audit log", () => {
    const decision = policy.canAccessReport(anAdmin(), report);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toContain("role");
  });
});
