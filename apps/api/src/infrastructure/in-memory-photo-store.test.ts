import { photoStoreContract } from "../test-support/photo-store.contract";
import { InMemoryPhotoStore } from "./in-memory-photo-store";

photoStoreContract("InMemoryPhotoStore", () => new InMemoryPhotoStore());
