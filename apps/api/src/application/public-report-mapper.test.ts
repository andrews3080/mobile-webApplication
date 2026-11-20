import { describe, it, expect } from "vitest";
import { PublicReportMapper } from "./public-report-mapper";
import { Location } from "../domain/location";
import { aReport, LATER } from "../test-support/builders";

// Requirement 4: no contact details or precise coordinates on any public page
describe("PublicReportMapper", () => {
  const sensitive = aReport("ABCD-EFGH-JKMN", {
    description: "Private description text from the reporter",
    location: Location.create({ area: "Sample Community", latitude: 5.123456, longitude: -0.654321 }),
    contact: { name: "Kwame Test", phone: "0240000000", email: "kwame@example.com" },
    photoKeys: ["photos/secret-key-1.jpg"],
  })
    .transitionTo("under_review", "officer-777", LATER)
    .transitionTo("verified", "officer-777", LATER, "Internal reason text");

  const view = new PublicReportMapper().toView(sensitive);
  const output = JSON.stringify(view);

  it("never contains contact details", () => {
    expect(output).not.toContain("Kwame");
    expect(output).not.toContain("0240000000");
    expect(output).not.toContain("kwame@example.com");
  });

  it("never contains precise coordinates", () => {
    expect(output).not.toContain("5.123456");
    expect(output).not.toContain("-0.654321");
  });

  it("never contains officer ids, internal reasons, photo keys or the description", () => {
    expect(output).not.toContain("officer-777");
    expect(output).not.toContain("Internal reason text");
    expect(output).not.toContain("secret-key-1");
    expect(output).not.toContain("Private description");
  });

  it("exposes only the agreed fields (an allowlist)", () => {
    expect(Object.keys(view).sort()).toEqual(
      ["area", "category", "photoCount", "question", "reference", "status", "submittedAt", "timeline", "updatedAt"],
    );
    expect(view.area).toBe("Sample Community");
  });
});
