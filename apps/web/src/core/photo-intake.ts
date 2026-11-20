import type { IdGenerator, ImageCompressor } from "./ports";
import { MAX_PHOTOS } from "./report-draft";
import type { DraftPhoto } from "./report-draft";

// Mirrors the API (apps/api photo-rules): photos must be 300 KB or less
export const MAX_PHOTO_BYTES = 300 * 1024;

export interface PhotoIntakeResult {
  added: DraftPhoto[];
  problems: string[]; // plain-language notes about files we could not take
}

// Turns picked files into draft photos: one at a time (phones have little memory),
// never more than MAX_PHOTOS in total, and every photo small enough for the server.
export async function preparePhotos(
  files: readonly Blob[],
  alreadyInDraft: number,
  compressor: ImageCompressor,
  ids: IdGenerator,
): Promise<PhotoIntakeResult> {
  const added: DraftPhoto[] = [];
  const problems: string[] = [];
  const room = Math.max(0, MAX_PHOTOS - alreadyInDraft);

  if (files.length > room) {
    problems.push(
      room === 0
        ? `You already have ${MAX_PHOTOS} photos. Remove one to add another.`
        : `Only ${room} more photo${room === 1 ? "" : "s"} can be added, so we took the first ${room}.`,
    );
  }

  for (const [index, file] of files.slice(0, room).entries()) {
    const label = `Photo ${index + 1}`;
    if (file.type !== "" && !file.type.startsWith("image/")) {
      problems.push(`${label} is not a picture, so it was skipped.`);
      continue;
    }
    try {
      const image = await compressor.compress(file, MAX_PHOTO_BYTES);
      if (image.bytes.byteLength > MAX_PHOTO_BYTES) {
        problems.push(`${label} is too large even after shrinking it, so it was skipped.`);
        continue;
      }
      added.push({ id: ids.next(), contentType: image.contentType, bytes: image.bytes });
    } catch {
      problems.push(`${label} could not be opened, so it was skipped.`);
    }
  }

  return { added, problems };
}
