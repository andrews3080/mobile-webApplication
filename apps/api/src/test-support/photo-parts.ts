import type { IdGenerator } from "../application/photo-ports";
import { HmacUploadSigner } from "../infrastructure/hmac-upload-signer";
import { ImageMetadataStripper } from "../infrastructure/image-metadata-stripper";
import { InMemoryPhotoStore } from "../infrastructure/in-memory-photo-store";

export const TEST_UPLOAD_SECRET = "test-upload-secret-0123456789-0123456789";

// Hands out 00000000000000000000000000000001, ...02, so tests know the photo keys in advance
export class SequenceIdGenerator implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return this.n.toString(16).padStart(32, "0");
  }
}

// Everything photo-related, with in-memory and real (pure) parts
export function makePhotoParts() {
  return {
    photos: new InMemoryPhotoStore(),
    sanitiser: new ImageMetadataStripper(),
    signer: new HmacUploadSigner(TEST_UPLOAD_SECRET),
    ids: new SequenceIdGenerator(),
  };
}
