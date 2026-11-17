import { draftStoreContract } from "../test-support/draft-store.contract";
import { InMemoryDraftStore } from "./in-memory-draft-store";

draftStoreContract("InMemoryDraftStore", () => new InMemoryDraftStore());
