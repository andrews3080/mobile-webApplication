// Milestone 1: photos must be 300 KB or less. The client compresses first, the server enforces it.
export const MAX_PHOTO_BYTES = 300 * 1024;

// How long an upload link stays valid
export const SLOT_LIFETIME_MS = 10 * 60 * 1000;
