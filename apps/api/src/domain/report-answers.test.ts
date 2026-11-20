import { describe, it, expect } from "vitest";
import { DomainError } from "./errors";
import { aReport, LATER } from "../test-support/builders";

const ASKED = new Date(LATER.getTime() + 60_000);
const ANSWERED = new Date(LATER.getTime() + 120_000);

function waitingForAnswer() {
  return aReport()
    .transitionTo("under_review", "officer-1", LATER)
    .transitionTo("more_information_requested", "officer-1", ASKED, "Which side of the river is the site?");
}

describe("reporter answers", () => {
  it("shows the open question while the report waits for more information", () => {
    expect(waitingForAnswer().openQuestion()).toEqual({
      question: "Which side of the river is the site?",
      askedAt: ASKED,
      answeredAt: undefined,
    });
  });

  it("has no open question in any other status", () => {
    expect(aReport().openQuestion()).toBeNull();
    expect(aReport().transitionTo("under_review", "officer-1", LATER).openQuestion()).toBeNull();
  });

  it("takes one answer, tidied, without changing the status", () => {
    const answered = waitingForAnswer().answerQuestion("  The east bank, past the bridge  ", ANSWERED);
    expect(answered.replies).toEqual([{ answer: "The east bank, past the bridge", at: ANSWERED }]);
    expect(answered.status).toBe("more_information_requested");
    expect(answered.openQuestion()?.answeredAt).toEqual(ANSWERED);
  });

  it("refuses a second answer to the same question", () => {
    const answered = waitingForAnswer().answerQuestion("The east bank", ANSWERED);
    expect(() => answered.answerQuestion("Also the west bank", ANSWERED)).toThrow(DomainError);
  });

  it("refuses an empty or overlong answer", () => {
    expect(() => waitingForAnswer().answerQuestion(" ", ANSWERED)).toThrow(DomainError);
    expect(() => waitingForAnswer().answerQuestion("x".repeat(1001), ANSWERED)).toThrow(DomainError);
  });

  it("refuses an answer when nothing was asked", () => {
    expect(() => aReport().answerQuestion("Hello", ANSWERED)).toThrow(DomainError);
  });

  it("keeps the answers when the review moves on, and a new question can be answered again", () => {
    const later = new Date(ANSWERED.getTime() + 60_000);
    const report = waitingForAnswer()
      .answerQuestion("The east bank", ANSWERED)
      .transitionTo("under_review", "officer-1", later)
      .transitionTo("more_information_requested", "officer-1", new Date(later.getTime() + 1000), "How many machines?");
    expect(report.replies).toHaveLength(1);
    expect(report.openQuestion()?.answeredAt).toBeUndefined();
    expect(report.answerQuestion("Two excavators", new Date(later.getTime() + 2000)).replies).toHaveLength(2);
  });
});
