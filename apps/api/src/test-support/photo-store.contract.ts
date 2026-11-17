import { describe, it, expect } from "vitest";
import type { PhotoStore } from "../application/photo-ports";

const KEY_A = `photos/${"a".repeat(32)}.jpg`;
const KEY_B = `photos/${"b".repeat(32)}.png`;
const BYTES = Uint8Array.from([1, 2, 3, 4, 5]);

// The rules EVERY PhotoStore must obey. Today: memory and disk. Later: the same rules for S3.
export function photoStoreContract(name: string, makeStore: () => PhotoStore): void {
  describe(`${name} follows the PhotoStore contract`, () => {
    it("stores a photo and reads back the same bytes with the right type", async () => {
      const store = makeStore();
      expect(await store.putIfAbsent(KEY_A, BYTES)).toBe(true);
      const photo = await store.read(KEY_A);
      expect(photo?.contentType).toBe("image/jpeg");
      expect(Array.from(photo?.bytes ?? [])).toEqual([1, 2, 3, 4, 5]);
    });

    it("derives the type from the key (png)", async () => {
      const store = makeStore();
      await store.putIfAbsent(KEY_B, BYTES);
      expect((await store.read(KEY_B))?.contentType).toBe("image/png");
    });

    it("refuses to overwrite: the second save returns false and the first photo survives", async () => {
      const store = makeStore();
      await store.putIfAbsent(KEY_A, BYTES);
      expect(await store.putIfAbsent(KEY_A, Uint8Array.from([9, 9, 9]))).toBe(false);
      expect(Array.from((await store.read(KEY_A))?.bytes ?? [])).toEqual([1, 2, 3, 4, 5]);
    });

    it("lets exactly one of two simultaneous saves win", async () => {
      const store = makeStore();
      const results = await Promise.all([store.putIfAbsent(KEY_A, BYTES), store.putIfAbsent(KEY_A, BYTES)]);
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("returns null for a photo that does not exist", async () => {
      expect(await makeStore().read(KEY_A)).toBeNull();
    });

    it("reports whether all the given photos exist", async () => {
      const store = makeStore();
      await store.putIfAbsent(KEY_A, BYTES);
      expect(await store.allExist([KEY_A])).toBe(true);
      expect(await store.allExist([KEY_A, KEY_B])).toBe(false);
      expect(await store.allExist([])).toBe(true);
    });

    it("refuses keys with path tricks", async () => {
      const store = makeStore();
      await expect(store.putIfAbsent("../evil.jpg", BYTES)).rejects.toThrow();
      await expect(store.putIfAbsent("photos/../evil.jpg", BYTES)).rejects.toThrow();
      expect(await store.read("../evil.jpg")).toBeNull();
      expect(await store.allExist(["../evil.jpg"])).toBe(false);
    });
  });
}
