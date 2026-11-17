import type { ImageType } from "../domain/image-type";

export interface StoredPhoto {
  bytes: Uint8Array;
  contentType: ImageType;
}

// Small interfaces, one per job (Interface Segregation)
export interface PhotoWriter {
  // Saves the photo ONLY if nothing is stored under this key yet. Returns false if the key is taken.
  putIfAbsent(key: string, bytes: Uint8Array): Promise<boolean>;
}
export interface PhotoReader {
  read(key: string): Promise<StoredPhoto | null>;
}
export interface PhotoChecker {
  allExist(keys: readonly string[]): Promise<boolean>;
}
export interface PhotoStore extends PhotoWriter, PhotoReader, PhotoChecker {}

// Removes hidden data (GPS, camera info, comments) from an image. Throws DomainError if the file is damaged.
export interface PhotoSanitiser {
  sanitise(bytes: Uint8Array, type: ImageType): Uint8Array;
}

// Signs an upload link so it cannot be forged or extended
export interface UploadSigner {
  sign(key: string, expiresAtMs: number): string;
  verify(key: string, expiresAtMs: number, signature: string): boolean;
}

export interface IdGenerator {
  next(): string; // 32 hex characters
}
