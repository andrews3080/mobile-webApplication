import { describe, it, expect } from "vitest";
import {
  addPhoto,
  clearPosition,
  fromLocalInputValue,
  removePhoto,
  setPosition,
  setText,
  toLocalInputValue,
} from "./draft-editor";
import { aDraft, aPhoto, NOW } from "../test-support/fakes";

describe("draft editor", () => {
  it("changes one text field and stamps the time, leaving the original alone", () => {
    const before = aDraft();
    const after = setText(before, "area", "Tarkwa", NOW);
    expect(after.area).toBe("Tarkwa");
    expect(after.updatedAt).toBe(NOW.toISOString());
    expect(before.area).toBe("Sample Community");
  });

  it("sets and clears the map position together", () => {
    const placed = setPosition(aDraft(), { latitude: 5.3, longitude: -2 }, NOW);
    expect([placed.latitude, placed.longitude]).toEqual([5.3, -2]);
    const cleared = clearPosition(placed, NOW);
    expect("latitude" in cleared).toBe(false);
    expect("longitude" in cleared).toBe(false);
  });

  it("adds and removes photos by id", () => {
    const withTwo = addPhoto(addPhoto(aDraft(), aPhoto("a"), NOW), aPhoto("b"), NOW);
    expect(removePhoto(withTwo, "a", NOW).photos.map((p) => p.id)).toEqual(["b"]);
  });
});

describe("date-time input conversion", () => {
  it("round-trips through the local input format to the minute", () => {
    const iso = new Date(2026, 10, 14, 9, 30).toISOString(); // 14 Nov 2026, 09:30 local time
    expect(toLocalInputValue(iso)).toBe("2026-11-14T09:30");
    expect(fromLocalInputValue("2026-11-14T09:30")).toBe(iso);
  });

  it("gives empty text for missing or broken values", () => {
    expect(toLocalInputValue("nonsense")).toBe("");
    expect(fromLocalInputValue("")).toBe("");
    expect(fromLocalInputValue("not a date")).toBe("");
  });
});
