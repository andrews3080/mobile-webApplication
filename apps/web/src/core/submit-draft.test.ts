import { describe, it, expect } from "vitest";
import { ApiError, DraftInvalidError } from "./errors";
import { SubmitDraft } from "./submit-draft";
import { InMemoryDraftStore } from "../infrastructure/in-memory-draft-store";
import {
  aDraft,
  aPhoto,
  FakePhotoApi,
  FakeReportApi,
  FixedClock,
  networkError,
  RecordingSleeper,
  rejectedError,
  serverError,
} from "../test-support/fakes";

function setup() {
  const drafts = new InMemoryDraftStore();
  const photos = new FakePhotoApi();
  const reports = new FakeReportApi();
  const sleeper = new RecordingSleeper();
  const useCase = new SubmitDraft(drafts, photos, reports, new FixedClock(), sleeper);
  return { drafts, photos, reports, sleeper, useCase };
}

describe("SubmitDraft", () => {
  it("sends a report with no photos, returns the code and clears the draft", async () => {
    const { drafts, reports, useCase } = setup();
    const draft = aDraft();
    await drafts.save(draft);

    const receipt = await useCase.execute(draft);

    expect(receipt).toEqual({ reference: "ABCD-EFGH-JKMN", alreadyReceived: false });
    expect(reports.submitted).toHaveLength(1);
    expect(reports.submitted[0]?.key).toBe("key-0123456789abcdef");
    expect(reports.submitted[0]?.body.photoKeys).toEqual([]);
    expect(await drafts.load()).toBeNull();
  });

  it("uploads each photo first and attaches their keys, in order", async () => {
    const { photos, reports, useCase } = setup();
    await useCase.execute(aDraft({ photos: [aPhoto("a"), aPhoto("b")] }));

    expect(photos.sent).toHaveLength(2);
    expect(photos.sent[0]?.size).toBe(3);
    expect(reports.submitted[0]?.body.photoKeys).toEqual([
      "photos/00000000000000000000000000000001.jpg",
      "photos/00000000000000000000000000000002.jpg",
    ]);
  });

  it("tidies the request: trims text, drops blank contact, keeps coordinates", async () => {
    const { reports, useCase } = setup();
    await useCase.execute(aDraft({ description: "  Muddy water near the river  ", area: " Sample Community ", latitude: 5.5, longitude: -0.5 }));
    const body = reports.submitted[0]?.body;
    expect(body?.description).toBe("Muddy water near the river");
    expect(body?.area).toBe("Sample Community");
    expect(body?.latitude).toBe(5.5);
    expect(body?.contact).toBeUndefined();
  });

  it("includes contact details only when the reporter gave some", async () => {
    const { reports, useCase } = setup();
    await useCase.execute(aDraft({ contactPhone: " 0240000000 " }));
    expect(reports.submitted[0]?.body.contact).toEqual({ name: undefined, phone: "0240000000", email: undefined });
  });

  it("retries a flaky photo upload with a fresh slot and still succeeds", async () => {
    const { photos, sleeper, useCase } = setup();
    photos.failNext(networkError());
    await useCase.execute(aDraft({ photos: [aPhoto()] }));
    expect(photos.slots).toHaveLength(2); // a new slot for the second attempt
    expect(photos.sent).toHaveLength(1);
    expect(sleeper.waits).toEqual([1000]);
  });

  it("retries the report itself, always with the same idempotency key", async () => {
    const { reports, useCase } = setup();
    reports.failNext(networkError(), serverError());
    const receipt = await useCase.execute(aDraft());
    expect(receipt.reference).toBe("ABCD-EFGH-JKMN");
    expect(reports.submitted).toHaveLength(3);
    expect(new Set(reports.submitted.map((s) => s.key)).size).toBe(1);
  });

  it("keeps the draft when it finally gives up", async () => {
    const { drafts, reports, useCase } = setup();
    const draft = aDraft();
    await drafts.save(draft);
    reports.failNext(serverError(), serverError(), serverError(), serverError());

    await expect(useCase.execute(draft)).rejects.toThrow(ApiError);

    expect(reports.submitted).toHaveLength(4);
    expect(await drafts.load()).not.toBeNull(); // the reporter loses nothing
  });

  it("resumes later without uploading the photos again", async () => {
    const { drafts, photos, reports, useCase } = setup();
    const draft = aDraft({ photos: [aPhoto()] });
    await drafts.save(draft);
    reports.failNext(serverError(), serverError(), serverError(), serverError());
    await expect(useCase.execute(draft)).rejects.toThrow(ApiError);

    // The photo went up during the failed run, and the draft remembers it
    const saved = await drafts.load();
    if (!saved) throw new Error("the draft was lost");
    expect(saved.photos[0]?.uploadedKey).toBeDefined();
    expect(photos.slots).toHaveLength(1);

    // Second run, as if the reporter pressed "send" again later
    const receipt = await useCase.execute(saved);
    expect(photos.slots).toHaveLength(1); // not uploaded a second time
    expect(reports.submitted.at(-1)?.key).toBe(draft.idempotencyKey);
    expect(receipt.reference).toBe("ABCD-EFGH-JKMN");
    expect(await drafts.load()).toBeNull();
  });

  it("does not retry when the server says no, and keeps the draft", async () => {
    const { drafts, reports, useCase } = setup();
    const draft = aDraft();
    await drafts.save(draft);
    reports.failNext(rejectedError());
    await expect(useCase.execute(draft)).rejects.toMatchObject({ kind: "rejected" });
    expect(reports.submitted).toHaveLength(1);
    expect(await drafts.load()).not.toBeNull();
  });

  it("refuses an invalid draft before touching the network", async () => {
    const { photos, reports, useCase } = setup();
    const error = await useCase.execute(aDraft({ description: "", photos: [aPhoto()] })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DraftInvalidError);
    expect((error as DraftInvalidError).problems["description"]).toBeDefined();
    expect(photos.slots).toHaveLength(0);
    expect(reports.submitted).toHaveLength(0);
  });
});
