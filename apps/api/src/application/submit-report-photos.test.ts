import { describe, it, expect } from "vitest";
import { InvalidRequestError } from "./errors";
import { SubmitReport } from "./submit-report";
import type { SubmitReportInput } from "./submit-report";
import { InMemoryPhotoStore } from "../infrastructure/in-memory-photo-store";
import { InMemoryReportRepository } from "../infrastructure/in-memory-report-repository";
import { FixedClock, RecordingNotifier, SequenceReferenceGenerator } from "../test-support/builders";
import { aJpeg } from "../test-support/fake-images";

const KEY = "11111111-2222-3333-4444-555555555555";
const PHOTO_1 = `photos/${"a".repeat(32)}.jpg`;
const PHOTO_2 = `photos/${"b".repeat(32)}.jpg`;

function input(photoKeys?: string[]): SubmitReportInput {
  return {
    idempotencyKey: KEY,
    description: "Muddy water and diggers near the river bank",
    category: "river_pollution",
    observedAt: new Date("2026-11-14T08:00:00Z"),
    area: "Sample Community",
    photoKeys,
  };
}

async function setup() {
  const repo = new InMemoryReportRepository();
  const photos = new InMemoryPhotoStore();
  await photos.putIfAbsent(PHOTO_1, aJpeg());
  const useCase = new SubmitReport(repo, new SequenceReferenceGenerator(), new RecordingNotifier(), new FixedClock(), photos);
  return { repo, photos, useCase };
}

describe("SubmitReport with photos", () => {
  it("accepts photos that were really uploaded", async () => {
    const { repo, useCase } = await setup();
    await useCase.execute(input([PHOTO_1]));
    expect(repo.count()).toBe(1);
  });

  it("still works with no photos at all", async () => {
    const { repo, useCase } = await setup();
    await useCase.execute(input());
    expect(repo.count()).toBe(1);
  });

  it("refuses a photo key that was never uploaded, and saves nothing", async () => {
    const { repo, useCase } = await setup();
    await expect(useCase.execute(input([PHOTO_2]))).rejects.toThrow(InvalidRequestError);
    expect(repo.count()).toBe(0);
  });

  it("refuses the whole report if only some photos were uploaded", async () => {
    const { repo, useCase } = await setup();
    await expect(useCase.execute(input([PHOTO_1, PHOTO_2]))).rejects.toThrow(InvalidRequestError);
    expect(repo.count()).toBe(0);
  });

  it("refuses made-up keys that are not in our format", async () => {
    const { useCase } = await setup();
    await expect(useCase.execute(input(["https://evil.example/x.jpg"]))).rejects.toThrow(InvalidRequestError);
    await expect(useCase.execute(input(["photos/../../etc/passwd"]))).rejects.toThrow(InvalidRequestError);
  });

  it("a retry with the same key and photos still returns the same report", async () => {
    const { repo, useCase } = await setup();
    const first = await useCase.execute(input([PHOTO_1]));
    const retry = await useCase.execute(input([PHOTO_1]));
    expect(retry.reference).toBe(first.reference);
    expect(repo.count()).toBe(1);
  });
});
