import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { imageTypeOfPhotoKey, isPhotoKey } from "../domain/image-type";
import type { PhotoStore, StoredPhoto } from "../application/photo-ports";

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === code;
}

// Saves photos as files in one folder. Fine for development and a single server.
// For deployment, an S3 version implements the same PhotoStore port.
export class LocalDiskPhotoStore implements PhotoStore {
  constructor(private readonly directory: string) {}

  private pathFor(key: string): string {
    // The strict key format blocks "../" tricks before any file is touched
    if (!isPhotoKey(key)) throw new Error("Not a valid photo key");
    return join(this.directory, key.slice("photos/".length));
  }

  async putIfAbsent(key: string, bytes: Uint8Array): Promise<boolean> {
    const path = this.pathFor(key);
    await mkdir(this.directory, { recursive: true });
    try {
      await writeFile(path, bytes, { flag: "wx" }); // "wx" = fail if the file already exists (atomic)
      return true;
    } catch (error) {
      if (hasCode(error, "EEXIST")) return false;
      throw error;
    }
  }

  async read(key: string): Promise<StoredPhoto | null> {
    const contentType = imageTypeOfPhotoKey(key);
    if (!contentType) return null;
    try {
      return { bytes: new Uint8Array(await readFile(this.pathFor(key))), contentType };
    } catch (error) {
      if (hasCode(error, "ENOENT")) return null;
      throw error;
    }
  }

  async allExist(keys: readonly string[]): Promise<boolean> {
    for (const key of keys) {
      if (!isPhotoKey(key)) return false;
      try {
        await access(this.pathFor(key));
      } catch {
        return false;
      }
    }
    return true;
  }
}
