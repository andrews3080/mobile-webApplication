import { describe, it, expect } from "vitest";
import { MAX_PHOTO_BYTES, preparePhotos } from "./photo-intake";
import { FakeCompressor, SequenceIds } from "../test-support/fakes";

const picture = (name = "x") => new Blob([name], { type: "image/jpeg" });

describe("preparePhotos", () => {
  it("compresses each picture and gives it an id", async () => {
    const compressor = new FakeCompressor();
    const result = await preparePhotos([picture(), picture()], 0, compressor, new SequenceIds());
    expect(result.added).toHaveLength(2);
    expect(result.added[0]?.contentType).toBe("image/jpeg");
    expect(new Set(result.added.map((p) => p.id)).size).toBe(2);
    expect(compressor.calls).toEqual([MAX_PHOTO_BYTES, MAX_PHOTO_BYTES]);
    expect(result.problems).toEqual([]);
  });

  it("takes only as many as still fit, and says so", async () => {
    const result = await preparePhotos([picture(), picture(), picture()], 3, new FakeCompressor(), new SequenceIds());
    expect(result.added).toHaveLength(2);
    expect(result.problems).toEqual(["Only 2 more photos can be added, so we took the first 2."]);
  });

  it("takes none when the draft is already full", async () => {
    const compressor = new FakeCompressor();
    const result = await preparePhotos([picture()], 5, compressor, new SequenceIds());
    expect(result.added).toEqual([]);
    expect(result.problems[0]).toContain("Remove one");
    expect(compressor.calls).toEqual([]);
  });

  it("skips files that are not pictures", async () => {
    const result = await preparePhotos([new Blob(["%PDF"], { type: "application/pdf" })], 0, new FakeCompressor(), new SequenceIds());
    expect(result.added).toEqual([]);
    expect(result.problems).toEqual(["Photo 1 is not a picture, so it was skipped."]);
  });

  it("skips pictures the browser cannot open, but keeps the rest", async () => {
    const compressor = new FakeCompressor();
    compressor.failOn = 1; // the first file is broken
    const result = await preparePhotos([picture(), picture()], 0, compressor, new SequenceIds());
    expect(result.added).toHaveLength(1);
    expect(result.problems).toEqual(["Photo 1 could not be opened, so it was skipped."]);
  });

  it("skips a picture that is still too large after shrinking", async () => {
    const compressor = new FakeCompressor();
    compressor.outputSize = MAX_PHOTO_BYTES + 1;
    const result = await preparePhotos([picture()], 0, compressor, new SequenceIds());
    expect(result.added).toEqual([]);
    expect(result.problems[0]).toContain("too large");
  });
});
