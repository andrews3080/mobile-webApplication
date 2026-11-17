import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { photoStoreContract } from "../test-support/photo-store.contract";
import { LocalDiskPhotoStore } from "./local-disk-photo-store";

// Every store gets its own temporary folder, deleted when the tests finish
const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

photoStoreContract("LocalDiskPhotoStore", () => {
  const folder = mkdtempSync(join(tmpdir(), "asaase-photos-"));
  folders.push(folder);
  return new LocalDiskPhotoStore(folder);
});
