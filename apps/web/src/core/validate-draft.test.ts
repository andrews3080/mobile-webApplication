import { describe, it, expect } from "vitest";
import { validateDraft } from "./validate-draft";
import { aDraft, aPhoto, NOW } from "../test-support/fakes";

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(aDraft(), NOW)).toEqual({});
  });

  it("asks for a longer description, and refuses an overlong one", () => {
    expect(validateDraft(aDraft({ description: "mining" }), NOW).description).toBeDefined();
    expect(validateDraft(aDraft({ description: "   short   " }), NOW).description).toBeDefined();
    expect(validateDraft(aDraft({ description: "x".repeat(2001) }), NOW).description).toBeDefined();
  });

  it("asks for a category from the list", () => {
    expect(validateDraft(aDraft({ category: "" }), NOW).category).toBeDefined();
    expect(validateDraft(aDraft({ category: "nonsense" }), NOW).category).toBeDefined();
  });

  it("refuses a date in the future but tolerates a clock a couple of minutes ahead", () => {
    expect(validateDraft(aDraft({ observedAt: "2026-11-15T10:00:00.000Z" }), NOW).observedAt).toBeDefined();
    expect(validateDraft(aDraft({ observedAt: "2026-11-14T10:02:00.000Z" }), NOW).observedAt).toBeUndefined();
    expect(validateDraft(aDraft({ observedAt: "not a date" }), NOW).observedAt).toBeDefined();
  });

  it("needs a place name", () => {
    expect(validateDraft(aDraft({ area: "   " }), NOW).area).toBeDefined();
    expect(validateDraft(aDraft({ area: "x".repeat(101) }), NOW).area).toBeDefined();
  });

  it("accepts a map position only when complete and in range", () => {
    expect(validateDraft(aDraft({ latitude: 5.5, longitude: -0.5 }), NOW).location).toBeUndefined();
    expect(validateDraft(aDraft({ latitude: 5.5 }), NOW).location).toBeDefined();
    expect(validateDraft(aDraft({ latitude: 95, longitude: 0 }), NOW).location).toBeDefined();
    expect(validateDraft(aDraft({ latitude: Number.NaN, longitude: 0 }), NOW).location).toBeDefined();
  });

  it("treats blank contact fields as fine, and checks the ones that are filled in", () => {
    expect(validateDraft(aDraft({ contactPhone: "  ", contactEmail: "" }), NOW)).toEqual({});
    expect(validateDraft(aDraft({ contactPhone: "123" }), NOW).contactPhone).toBeDefined();
    expect(validateDraft(aDraft({ contactEmail: "not-an-email" }), NOW).contactEmail).toBeDefined();
    expect(validateDraft(aDraft({ contactPhone: "+233 24 000 0000", contactEmail: "kwame@example.com" }), NOW)).toEqual({});
  });

  it("allows up to 5 photos, not 6", () => {
    const five = Array.from({ length: 5 }, (_, i) => aPhoto(`p${i}`));
    expect(validateDraft(aDraft({ photos: five }), NOW).photos).toBeUndefined();
    expect(validateDraft(aDraft({ photos: [...five, aPhoto("p6")] }), NOW).photos).toBeDefined();
  });

  it("reports every problem at once, not just the first", () => {
    const problems = validateDraft(aDraft({ description: "", category: "", area: "" }), NOW);
    expect(Object.keys(problems).sort()).toEqual(["area", "category", "description"]);
  });
});
