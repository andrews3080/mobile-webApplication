import { detectImageType, imageTypeOfPhotoKey, toImageType } from "../domain/image-type";
import { ConflictError, ForbiddenError, InvalidRequestError } from "./errors";
import { MAX_PHOTO_BYTES } from "./photo-rules";
import type { PhotoSanitiser, PhotoWriter, UploadSigner } from "./photo-ports";
import type { Clock } from "./ports";

export interface StorePhotoInput {
  key: string;
  expiresAtMs: number;
  signature: string;
  declaredType: string | undefined; // the Content-Type the sender claimed
  bytes: Uint8Array;
}

// Step 2: the actual upload. Every check happens BEFORE anything is stored.
export class StorePhoto {
  constructor(
    private readonly signer: UploadSigner,
    private readonly sanitiser: PhotoSanitiser,
    private readonly store: PhotoWriter,
    private readonly clock: Clock,
  ) {}

  async execute(input: StorePhotoInput): Promise<{ key: string; sizeBytes: number }> {
    const keyType = imageTypeOfPhotoKey(input.key);

    // One vague refusal for a bad key, a forged signature OR an expired link,
    // so nobody can learn which part was wrong
    if (
      keyType === null ||
      !this.signer.verify(input.key, input.expiresAtMs, input.signature) ||
      this.clock.now().getTime() > input.expiresAtMs
    ) {
      throw new ForbiddenError("This upload link is not valid or has expired");
    }

    if (input.bytes.length === 0) throw new InvalidRequestError("The photo is empty");
    if (input.bytes.length > MAX_PHOTO_BYTES) {
      throw new InvalidRequestError(`Photos must be ${MAX_PHOTO_BYTES / 1024} KB or smaller`);
    }

    // The slot, the label AND the real file bytes must all agree
    const declared = toImageType(input.declaredType);
    const actual = detectImageType(input.bytes);
    if (declared !== keyType || actual !== keyType) {
      throw new InvalidRequestError("The file is not the kind of image it claims to be");
    }

    // Removes GPS and other hidden data. Throws DomainError if the file is damaged.
    const clean = this.sanitiser.sanitise(input.bytes, keyType);

    const stored = await this.store.putIfAbsent(input.key, clean);
    if (!stored) throw new ConflictError("This upload link was already used");

    return { key: input.key, sizeBytes: clean.length };
  }
}
