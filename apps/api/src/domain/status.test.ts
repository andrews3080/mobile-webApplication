import { describe, it, expect } from "vitest";
import { REPORT_STATUSES, canTransition } from "./status";

describe("status rules", () => {
  it("allows a received report to go under review", () => {
    expect(canTransition("received", "under_review")).toBe(true);
  });

  it("does not allow skipping review", () => {
    expect(canTransition("received", "verified")).toBe(false);
    expect(canTransition("received", "rejected")).toBe(false);
  });

  it("lets a closed report go nowhere", () => {
    for (const status of REPORT_STATUSES) {
      expect(canTransition("closed", status)).toBe(false);
    }
  });

  it("sends a report back to review after information is provided", () => {
    expect(canTransition("more_information_requested", "under_review")).toBe(true);
  });
});
