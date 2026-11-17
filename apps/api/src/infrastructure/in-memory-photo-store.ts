import { imageTypeOfPhotoKey, isPhotoKey } from "../domain/image-type";
import type { PhotoStore, StoredPhoto } from "../application/photo-ports";

export class InMemoryPhotoStore implements PhotoStore {
  private readonly items = new Map<string, Uint8Array>();

  async putIfAbsent(key: string, bytes: Uint8Array): Promise<boolean> {
    if (!isPhotoKey(key)) throw new Error("Not a valid photo key");
    if (this.items.has(key)) return false;
    this.items.set(key, new Uint8Array(bytes)); // a copy, so later changes to the input cannot alter it
    return true;
  }

  async read(key: string): Promise<StoredPhoto | null> {
    const bytes = this.items.get(key);
    const contentType = imageTypeOfPhotoKey(key);
    if (!bytes || !contentType) return null;
    return { bytes: new Uint8Array(bytes), contentType };
  }

  async allExist(keys: readonly string[]): Promise<boolean> {
    return keys.every((key) => this.items.has(key));
  }

  // Handy for tests only. Not part of any port.
  count(): number {
    return this.items.size;
  }
}
