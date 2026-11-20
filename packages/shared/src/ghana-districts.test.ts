import { describe, it, expect } from "vitest";
import { districtsOf, GHANA_DISTRICTS, GHANA_REGIONS, isKnownArea, regionOfArea, unknownDistrictArea } from "./ghana-districts";

describe("Ghana districts", () => {
  it("has the 16 regions and 261 assemblies", () => {
    expect(GHANA_REGIONS).toHaveLength(16);
    expect(Object.values(GHANA_DISTRICTS).flat()).toHaveLength(261);
  });

  it("never lists the same district twice, and keeps every name short enough for the API (100 characters)", () => {
    const all = Object.values(GHANA_DISTRICTS).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const region of GHANA_REGIONS) expect(unknownDistrictArea(region).length).toBeLessThanOrEqual(100);
  });

  it("finds the region of a district or of a 'district not known' area", () => {
    expect(regionOfArea("Tarkwa-Nsuaem Municipal")).toBe("Western");
    expect(regionOfArea("Obuasi Municipal")).toBe("Ashanti");
    expect(regionOfArea("District not known, Western North Region")).toBe("Western North");
    expect(regionOfArea("Somewhere near the river")).toBeNull();
  });

  it("knows which areas are allowed", () => {
    expect(isKnownArea("Prestea-Huni Valley Municipal")).toBe(true);
    expect(isKnownArea(unknownDistrictArea("Eastern"))).toBe(true);
    expect(isKnownArea("Sample Community")).toBe(false);
  });

  it("gives no districts for an unknown region", () => {
    expect(districtsOf("Atlantis")).toEqual([]);
    expect(districtsOf("Western North")).toContain("Sefwi Wiawso Municipal");
  });
});
