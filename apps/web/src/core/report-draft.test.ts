import { describe, it, expect } from "vitest";
import { upgradeDraft } from "./report-draft";
import type { ReportDraft } from "./report-draft";
import { aDraft } from "../test-support/fakes";

// A draft saved on a phone before region and place details existed
function oldDraft(area: string): ReportDraft {
  const { region: _region, placeDetails: _details, ...rest } = aDraft({ area });
  return rest as ReportDraft;
}

describe("upgradeDraft", () => {
  it("keeps free text the reporter typed by moving it into the place details", () => {
    const upgraded = upgradeDraft(oldDraft("Near the Ankobra bridge"));
    expect(upgraded.placeDetails).toBe("Near the Ankobra bridge");
    expect(upgraded.area).toBe("");
    expect(upgraded.region).toBe("");
  });

  it("fills in the region when the old area is already a listed district", () => {
    const upgraded = upgradeDraft(oldDraft("Obuasi Municipal"));
    expect(upgraded).toMatchObject({ region: "Ashanti", area: "Obuasi Municipal", placeDetails: "" });
  });

  it("leaves a current draft as it is", () => {
    const draft = aDraft({ placeDetails: "By the school" });
    expect(upgradeDraft(draft)).toEqual(draft);
  });
});
