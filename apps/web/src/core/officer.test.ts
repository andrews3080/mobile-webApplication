import { describe, it, expect } from "vitest";
import { actionsFor, checkReason, photoFileName } from "./officer";

describe("actionsFor", () => {
  const names = (status: string) => actionsFor(status).map((a) => a.action);

  it("offers only the moves the API allows", () => {
    expect(names("received")).toEqual(["start-review"]);
    expect(names("more_information_requested")).toEqual(["start-review"]);
    expect(names("under_review")).toEqual(["verify", "reject", "request-information"]);
  });

  it("offers nothing once a decision is made (no API for later steps yet)", () => {
    for (const status of ["verified", "rejected", "referred_for_action", "closed", "something_new"]) {
      expect(names(status)).toEqual([]);
    }
  });

  it("asks for a written reason exactly where the API requires one", () => {
    const needsText = (status: string) => actionsFor(status).filter((a) => a.text).map((a) => a.action);
    expect(needsText("received")).toEqual([]);
    expect(needsText("under_review")).toEqual(["verify", "reject", "request-information"]);
  });
});

describe("checkReason", () => {
  it("needs at least 5 real characters, like the API", () => {
    expect(checkReason("")).toContain("Please write a reason");
    expect(checkReason("  ok  ")).toContain("at least 5");
    expect(checkReason("Seen on site visit")).toBeNull();
  });
});

describe("photoFileName", () => {
  it("drops the photos/ prefix", () => {
    expect(photoFileName("photos/abc123.jpg")).toBe("abc123.jpg");
  });
});
