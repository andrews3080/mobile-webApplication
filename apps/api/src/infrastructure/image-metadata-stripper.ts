import { DomainError } from "../domain/errors";
import type { ImageType } from "../domain/image-type";
import type { PhotoSanitiser } from "../application/photo-ports";

const DAMAGED = "The image file is damaged or incomplete";

// --- small helpers (a missing byte means a damaged file) ---

function byteAt(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined) throw new DomainError(DAMAGED);
  return value;
}
function u16be(bytes: Uint8Array, at: number): number {
  return (byteAt(bytes, at) << 8) | byteAt(bytes, at + 1);
}
function u32be(bytes: Uint8Array, at: number): number {
  return byteAt(bytes, at) * 2 ** 24 + (byteAt(bytes, at + 1) << 16) + (byteAt(bytes, at + 2) << 8) + byteAt(bytes, at + 3);
}
function u32le(bytes: Uint8Array, at: number): number {
  return byteAt(bytes, at) + (byteAt(bytes, at + 1) << 8) + (byteAt(bytes, at + 2) << 16) + byteAt(bytes, at + 3) * 2 ** 24;
}
function ascii(bytes: Uint8Array, at: number, length: number): string {
  let text = "";
  for (let i = 0; i < length; i++) text += String.fromCharCode(byteAt(bytes, at + i));
  return text;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// --- JPEG ---
// A JPEG is a list of segments. We copy the ones needed to draw the picture and drop
// the ones that can hold personal data: EXIF/GPS and XMP (APP1), IPTC (APP13), comments.
const JPEG_KEEP_APP = new Set([0xe0, 0xe2, 0xee]); // JFIF, ICC colour profile, Adobe colour info

function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (byteAt(bytes, 0) !== 0xff || byteAt(bytes, 1) !== 0xd8) throw new DomainError(DAMAGED);
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let pos = 2;

  for (;;) {
    if (byteAt(bytes, pos) !== 0xff) throw new DomainError(DAMAGED);
    while (byteAt(bytes, pos + 1) === 0xff) pos++; // skip padding bytes
    const marker = byteAt(bytes, pos + 1);

    if (marker === 0xd9) throw new DomainError(DAMAGED); // ended before any picture data
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      parts.push(bytes.subarray(pos, pos + 2)); // markers with no length
      pos += 2;
      continue;
    }

    const length = u16be(bytes, pos + 2);
    const end = pos + 2 + length;
    if (length < 2 || end > bytes.length) throw new DomainError(DAMAGED);

    if (marker === 0xda) {
      // Start of scan: the compressed picture. Keep it up to the END marker and drop anything after.
      for (let i = end; i < bytes.length - 1; i++) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
          parts.push(bytes.subarray(pos, i + 2));
          return concat(parts);
        }
      }
      throw new DomainError(DAMAGED);
    }

    const isMetadata = (marker >= 0xe0 && marker <= 0xef && !JPEG_KEEP_APP.has(marker)) || marker === 0xfe;
    if (!isMetadata) parts.push(bytes.subarray(pos, end));
    pos = end;
  }
}

// --- PNG ---
// A PNG is a list of chunks. We keep an allowlist of the ones needed to draw the picture.
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs", "bKGD"]);

function stripPng(bytes: Uint8Array): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  signature.forEach((value, index) => {
    if (byteAt(bytes, index) !== value) throw new DomainError(DAMAGED);
  });
  if (ascii(bytes, 12, 4) !== "IHDR") throw new DomainError(DAMAGED);

  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let pos = 8;
  while (pos < bytes.length) {
    const length = u32be(bytes, pos);
    const type = ascii(bytes, pos + 4, 4);
    const end = pos + 12 + length; // length + type + data + checksum
    if (end > bytes.length) throw new DomainError(DAMAGED);

    if (PNG_KEEP.has(type)) parts.push(bytes.subarray(pos, end)); // text, EXIF and time chunks are dropped
    pos = end;
    if (type === "IEND") return concat(parts); // anything after the end is dropped
  }
  throw new DomainError(DAMAGED); // never reached IEND
}

// --- WebP ---
// A WebP is a RIFF file of chunks. We drop the EXIF and XMP chunks and clear their flags.
function stripWebp(bytes: Uint8Array): Uint8Array {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") throw new DomainError(DAMAGED);
  const declared = u32le(bytes, 4) + 8;
  if (declared < 12 || declared > bytes.length) throw new DomainError(DAMAGED);

  const body: Uint8Array[] = [];
  let sawImage = false;
  let pos = 12;
  while (pos + 8 <= declared) {
    const type = ascii(bytes, pos, 4);
    const size = u32le(bytes, pos + 4);
    const dataEnd = pos + 8 + size;
    if (dataEnd > declared) throw new DomainError(DAMAGED);

    if (type === "VP8 " || type === "VP8L" || type === "VP8X") sawImage = true;
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = bytes.slice(pos, dataEnd); // a copy, so the original stays untouched
      if (type === "VP8X" && size >= 1) chunk[8] = byteAt(chunk, 8) & 0xf3; // clear the EXIF and XMP flags
      body.push(chunk);
      if (size % 2 === 1) body.push(new Uint8Array([0])); // chunks are padded to an even length
    }
    pos = dataEnd + (size % 2);
  }
  if (!sawImage) throw new DomainError(DAMAGED);

  const size = 4 + body.reduce((sum, part) => sum + part.length, 0); // "WEBP" + chunks
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  header.set([size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff], 4);
  header.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  return concat([header, ...body]);
}

// Works on the raw bytes and never re-encodes, so picture quality does not change
export class ImageMetadataStripper implements PhotoSanitiser {
  sanitise(bytes: Uint8Array, type: ImageType): Uint8Array {
    switch (type) {
      case "image/jpeg":
        return stripJpeg(bytes);
      case "image/png":
        return stripPng(bytes);
      case "image/webp":
        return stripWebp(bytes);
    }
  }
}
