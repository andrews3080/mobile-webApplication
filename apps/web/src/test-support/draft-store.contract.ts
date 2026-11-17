import { describe, it, expect } from "vitest";
import type { DraftStore } from "../core/ports";
import { aDraft, aPhoto } from "./fakes";

const bytesOf = (buffer: ArrayBuffer | undefined) => Array.from(new Uint8Array(buffer ?? new ArrayBuffer(0)));

// The rules EVERY DraftStore must obey. Today: memory and IndexedDB.
export function draftStoreContract(name: string, makeStore: () => DraftStore): void {
  async function freshStore(): Promise<DraftStore> {
    const store = makeStore();
    await store.clear(); // IndexedDB keeps data between tests in one run, so start clean
    return store;
  }

  describe(`${name} follows the DraftStore contract`, () => {
    it("is empty to begin with", async () => {
      expect(await (await freshStore()).load()).toBeNull();
    });

    it("saves a draft and loads it back", async () => {
      const store = await freshStore();
      await store.save(aDraft({ description: "Diggers near the river bank", latitude: 5.5, longitude: -0.5 }));
      const loaded = await store.load();
      expect(loaded?.description).toBe("Diggers near the river bank");
      expect(loaded?.latitude).toBe(5.5);
      expect(loaded?.idempotencyKey).toBe("key-0123456789abcdef");
    });

    it("keeps photo bytes intact, and the uploaded marker", async () => {
      const store = await freshStore();
      await store.save(aDraft({ photos: [{ ...aPhoto("p1"), uploadedKey: "photos/abc.jpg" }] }));
      const photo = (await store.load())?.photos[0];
      expect(bytesOf(photo?.bytes)).toEqual([1, 2, 3]);
      expect(photo?.contentType).toBe("image/jpeg");
      expect(photo?.uploadedKey).toBe("photos/abc.jpg");
    });

    it("replaces the old draft when saved again", async () => {
      const store = await freshStore();
      await store.save(aDraft({ description: "first version of the text" }));
      await store.save(aDraft({ description: "second version of the text" }));
      expect((await store.load())?.description).toBe("second version of the text");
    });

    it("forgets the draft after clear", async () => {
      const store = await freshStore();
      await store.save(aDraft());
      await store.clear();
      expect(await store.load()).toBeNull();
    });

    it("gives back a copy, so changing it does not change what is stored", async () => {
      const store = await freshStore();
      await store.save(aDraft({ description: "original description text" }));
      const loaded = await store.load();
      if (loaded) loaded.description = "changed by a caller";
      expect((await store.load())?.description).toBe("original description text");
    });
  });
}
