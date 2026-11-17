import { DraftStorageFullError } from "../core/errors";
import type { DraftStore } from "../core/ports";
import type { ReportDraft } from "../core/report-draft";

const DATABASE_NAME = "asaase-ani";
const STORE_NAME = "drafts";
const CURRENT = "current"; // we keep ONE draft at a time

// Storage can run out on a full phone. Say so clearly instead of failing silently.
function translate(error: unknown): Error {
  if (error instanceof Error && error.name === "QuotaExceededError") return new DraftStorageFullError();
  return error instanceof Error ? error : new Error("Saving on this device failed");
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(translate(request.error));
  });
}

// Runs one operation and resolves only when the browser has really committed it
async function inTransaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(translate(transaction.error));
      transaction.onabort = () => reject(translate(transaction.error)); // a full disk shows up here
    });
  } finally {
    database.close();
  }
}

// Keeps the draft in the browser's own database, so it survives a refresh, a crash or a dead battery
export class IndexedDbDraftStore implements DraftStore {
  async load(): Promise<ReportDraft | null> {
    const found = await inTransaction<unknown>("readonly", (store) => store.get(CURRENT));
    return (found as ReportDraft | undefined) ?? null;
  }

  async save(draft: ReportDraft): Promise<void> {
    await inTransaction("readwrite", (store) => store.put(draft, CURRENT));
  }

  async clear(): Promise<void> {
    await inTransaction("readwrite", (store) => store.delete(CURRENT));
  }
}
