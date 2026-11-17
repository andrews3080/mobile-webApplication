import { buildPhotoKey, toImageType } from "../domain/image-type";
import type { ImageType } from "../domain/image-type";
import { InvalidRequestError } from "./errors";
import { MAX_PHOTO_BYTES, SLOT_LIFETIME_MS } from "./photo-rules";
import type { IdGenerator, UploadSigner } from "./photo-ports";
import type { Clock } from "./ports";

export interface UploadSlot {
  key: string; // what the report will refer to
  expiresAtMs: number;
  signature: string;
  contentType: ImageType;
  maxBytes: number;
}

// Step 1 of a photo upload: check the plan, hand out a signed, expiring slot
export class CreateUploadSlot {
  constructor(
    private readonly ids: IdGenerator,
    private readonly signer: UploadSigner,
    private readonly clock: Clock,
  ) {}

  async execute(input: { contentType: string; sizeBytes: number }): Promise<UploadSlot> {
    const type = toImageType(input.contentType);
    if (!type) throw new InvalidRequestError("Photos must be JPEG, PNG or WebP");

    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) {
      throw new InvalidRequestError("The photo size is not valid");
    }
    if (input.sizeBytes > MAX_PHOTO_BYTES) {
      throw new InvalidRequestError(`Photos must be ${MAX_PHOTO_BYTES / 1024} KB or smaller. Compress the photo first.`);
    }

    const key = buildPhotoKey(this.ids.next(), type);
    const expiresAtMs = this.clock.now().getTime() + SLOT_LIFETIME_MS;
    return { key, expiresAtMs, signature: this.signer.sign(key, expiresAtMs), contentType: type, maxBytes: MAX_PHOTO_BYTES };
  }
}
