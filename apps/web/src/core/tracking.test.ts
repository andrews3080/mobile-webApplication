import { describe, it, expect } from "vitest";
import { categoryLabel, checkTrackingCode, describeStatus } from "./tracking";

describe("checkTrackingCode", () => {
  it("accepts a code typed the way it is shown", () => {
    expect(checkTrackingCode("ABCD-EFGH-JKMN")).toEqual({ ok: true, code: "ABCD-EFGH-JKMN" });
  });

  it("forgives lower case, spaces and missing dashes", () => {
    expect(checkTrackingCode(" abcd efgh jkmn ")).toEqual({ ok: true, code: "ABCD-EFGH-JKMN" });
    expect(checkTrackingCode("abcdefghjkmn")).toEqual({ ok: true, code: "ABCD-EFGH-JKMN" });
  });

  it("reads O as zero and I or L as one, like the server", () => {
    expect(checkTrackingCode("OOOO-IIII-LLLL")).toEqual({ ok: true, code: "0000-1111-1111" });
  });

  it("says what is wrong in plain words", () => {
    expect(checkTrackingCode("")).toEqual({ ok: false, problem: "Please enter your tracking code." });
    expect(checkTrackingCode("ABCD-EFGH")).toMatchObject({ ok: false, problem: expect.stringContaining("Yours has 8") });
    expect(checkTrackingCode("ABCD-EFGH-JKM!")).toMatchObject({ ok: false, problem: expect.stringContaining("only has letters and numbers") });
    expect(checkTrackingCode("ABCD-EFGH-JKMU")).toMatchObject({ ok: false }); // U is never used in codes
  });
});

describe("describeStatus", () => {
  it("explains every status the API can send", () => {
    for (const status of ["received", "under_review", "more_information_requested", "verified", "rejected", "referred_for_action", "closed"]) {
      expect(describeStatus(status).explanation).not.toBe("");
    }
  });

  it("still shows something for a status it does not know", () => {
    expect(describeStatus("on_hold")).toEqual({ label: "on hold", explanation: "", tone: "neutral" });
  });
});

describe("categoryLabel", () => {
  it("uses the same plain words as the form", () => {
    expect(categoryLabel("river_pollution")).toBe("Polluted river or stream");
    expect(categoryLabel("something_new")).toBe("something new");
  });
});
