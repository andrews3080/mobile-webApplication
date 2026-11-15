import { describe, it, expect } from "vitest";
import { OfficerReportMapper } from "./officer-report-mapper";
import { Location } from "../domain/location";
import { aReport, LATER } from "../test-support/builders";

const mapper = new OfficerReportMapper();

describe("OfficerReportMapper", () => {
  it("includes the full detail an officer needs", () => {
    const report = aReport("ABCD-EFGH-JKMN", {
      location: Location.create({ area: "Sample Community", latitude: 5.5, longitude: -0.5 }),
      contact: { phone: "0240000000" },
      photoKeys: ["photos/a.jpg"],
    });
    const view = mapper.toView(report);
    expect(view.reference).toBe("ABCD-EFGH-JKMN");
    expect(view.description).toContain("Muddy water");
    expect(view.latitude).toBe(5.5);
    expect(view.contact?.phone).toBe("0240000000");
    expect(view.photoKeys).toEqual(["photos/a.jpg"]);
  });

  it("uses null (not undefined) for missing optional data, so the JSON shape never changes", () => {
    const view = mapper.toView(aReport());
    expect(view.latitude).toBeNull();
    expect(view.longitude).toBeNull();
    expect(view.contact).toBeNull();
  });

  it("includes the status history with officer and reason", () => {
    const report = aReport()
      .transitionTo("under_review", "officer-1", LATER)
      .transitionTo("verified", "officer-1", LATER, "Photos match the site");
    const view = mapper.toView(report);
    expect(view.history).toHaveLength(2);
    expect(view.history[1]?.officerId).toBe("officer-1");
    expect(view.history[1]?.reason).toBe("Photos match the site");
    expect(view.history[0]?.reason).toBeNull();
  });
});
