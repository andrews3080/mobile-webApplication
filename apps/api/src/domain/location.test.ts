import { describe, it, expect } from "vitest";
import { Location } from "./location";
import { DomainError } from "./errors";

describe("Location", () => {
  it("accepts an area without GPS (picked from a district list)", () => {
    const loc = Location.create({ area: "Sample District" });
    expect(loc.hasCoordinates).toBe(false);
  });

  it("accepts an area with GPS coordinates", () => {
    const loc = Location.create({ area: "Sample District", latitude: 5.6, longitude: -0.2 });
    expect(loc.hasCoordinates).toBe(true);
  });

  it("rejects an empty area", () => {
    expect(() => Location.create({ area: "   " })).toThrow(DomainError);
  });

  it("rejects out-of-range coordinates", () => {
    expect(() => Location.create({ area: "X", latitude: 91, longitude: 0 })).toThrow(DomainError);
  });

  it("rejects a single coordinate", () => {
    expect(() => Location.create({ area: "X", latitude: 5.6 })).toThrow(DomainError);
  });

  it("public text contains the area only, never coordinates", () => {
    const loc = Location.create({ area: "Sample District", latitude: 5.6, longitude: -0.2 });
    expect(loc.toPublicArea()).toBe("Sample District");
  });
});
