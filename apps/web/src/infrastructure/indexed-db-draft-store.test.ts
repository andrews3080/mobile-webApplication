// Gives Node a fake copy of the browser's IndexedDB, so the REAL storage code can be tested
import "fake-indexeddb/auto";
import { draftStoreContract } from "../test-support/draft-store.contract";
import { IndexedDbDraftStore } from "./indexed-db-draft-store";

draftStoreContract("IndexedDbDraftStore", () => new IndexedDbDraftStore());
