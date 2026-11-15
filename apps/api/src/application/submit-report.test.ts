import { describe, it, expect } from "vitest";
import { SubmitReport } from "./submit-report";
import type { SubmitReportInput } from "./submit-report";
import { InMemoryReportRepository } from "../infrastructure/in-memory-report-repository";
import { ReferenceCode } from "../domain/reference-code";
import { DomainError } from "../domain/errors";
import { InvalidRequestError } from "./errors";
import type { Notifier } from "./ports";
import { FixedClock, RecordingNotifier, SequenceReferenceGenerator } from "../test-support/builders";

const KEY = "11111111-2222-3333-4444-555555555555";

function input(overrides: Partial<SubmitReportInput> = {}): SubmitReportInput {
  return {
    idempotencyKey: KEY,
    description: "Muddy water and diggers near the river bank",
    category: "river_pollution",
    observedAt: new Date("2026-11-14T08:00:00Z"),
    area: "Sample Community",
    ...overrides,
  };
}

// Builds the use case with fakes, so no database or phone is needed
function setup(notifier: Notifier = new RecordingNotifier()) {
  const repo = new InMemoryReportRepository();
  const useCase = new SubmitReport(repo, new SequenceReferenceGenerator(), notifier, new FixedClock());
  return { repo, useCase };
}

describe("SubmitReport", () => {
  it("stores the report and returns a formatted reference code", async () => {
    const { repo, useCase } = setup();
    const result = await useCase.execute(input());
    expect(result.reference).toBe("0000-0000-0001");
    expect(result.alreadyReceived).toBe(false);
    expect(await repo.findByReference(ReferenceCode.parse(result.reference))).not.toBeNull();
  });

  it("notifies officers once for a new report", async () => {
    const notifier = new RecordingNotifier();
    const { useCase } = setup(notifier);
    await useCase.execute(input());
    expect(notifier.sent).toHaveLength(1);
  });

  it("a retry with the same key creates 0 duplicates and returns the same code", async () => {
    const notifier = new RecordingNotifier();
    const { repo, useCase } = setup(notifier);
    const first = await useCase.execute(input());
    const retry = await useCase.execute(input());
    expect(retry.reference).toBe(first.reference);
    expect(retry.alreadyReceived).toBe(true);
    expect(repo.count()).toBe(1);
    expect(notifier.sent).toHaveLength(1); // officers are not alerted twice
  });

  it("still succeeds when the notification fails", async () => {
    const failing: Notifier = {
      notifyNewReport: async () => {
        throw new Error("push service is down");
      },
    };
    const { repo, useCase } = setup(failing);
    const result = await useCase.execute(input());
    expect(result.reference).toBe("0000-0000-0001");
    expect(repo.count()).toBe(1);
  });

  it("saves nothing and notifies nobody when the report is invalid", async () => {
    const notifier = new RecordingNotifier();
    const { repo, useCase } = setup(notifier);
    await expect(useCase.execute(input({ description: "short" }))).rejects.toThrow(DomainError);
    expect(repo.count()).toBe(0);
    expect(notifier.sent).toHaveLength(0);
  });

  it("rejects a missing or too short idempotency key", async () => {
    const { useCase } = setup();
    await expect(useCase.execute(input({ idempotencyKey: "" }))).rejects.toThrow(InvalidRequestError);
    await expect(useCase.execute(input({ idempotencyKey: "abc" }))).rejects.toThrow(InvalidRequestError);
  });
});
