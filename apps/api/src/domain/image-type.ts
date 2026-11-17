import { DomainError } from "./errors";

// SVG is NOT here on purpose: it can carry scripts. Photos only.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

const EXTENSION_OF: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TYPE_OF: Record<string, ImageType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Our photo keys always look like photos/<32 hex characters>.<jpg|png|webp>
// Being this strict also makes path tricks like "../" impossible.
const PHOTO_KEY = /^photos\/([0-9a-f]{32})\.(jpg|png|webp)$/;

export function toImageType(text: string | undefined): ImageType | null {
  return IMAGE_TYPES.find((type) => type === text) ?? null;
}

export function buildPhotoKey(id: string, type: ImageType): string {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new DomainError("A photo id must be 32 hex characters");
  return `photos/${id}.${EXTENSION_OF[type]}`;
}

export function isPhotoKey(key: string): boolean {
  return PHOTO_KEY.test(key);
}

export function imageTypeOfPhotoKey(key: string): ImageType | null {
  const extension = PHOTO_KEY.exec(key)?.[2];
  return extension ? (TYPE_OF[extension] ?? null) : null;
}

function matchesAt(bytes: Uint8Array, offset: number, values: readonly number[]): boolean {
  return values.every((value, index) => bytes[offset + index] === value);
}

// Looks at the FIRST BYTES of the file (its "magic numbers"), not at what the sender claims
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (matchesAt(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matchesAt(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (matchesAt(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && matchesAt(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp"; // "RIFF" .... "WEBP"
  }
  return null;
}
