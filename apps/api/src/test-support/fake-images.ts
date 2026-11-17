// Builds tiny fake images with hidden "secrets" inside, so tests can prove the secrets get removed.
// They are not real pictures. They only have the right STRUCTURE, which is all the cleaner reads.

function text(value: string): number[] {
  return [...value].map((char) => char.charCodeAt(0));
}
function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}
function u32le(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

// ---------- JPEG ----------
function jpegSegment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

export function aJpeg(options: { exifSecret?: string; comment?: string; trailing?: string } = {}): Uint8Array {
  const bytes: number[] = [0xff, 0xd8]; // start of image
  bytes.push(...jpegSegment(0xe0, [...text("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])); // JFIF header (kept)
  if (options.exifSecret) bytes.push(...jpegSegment(0xe1, [...text("Exif"), 0, 0, ...text(options.exifSecret)]));
  if (options.comment) bytes.push(...jpegSegment(0xfe, text(options.comment)));
  bytes.push(...jpegSegment(0xda, [1, 1, 0, 0, 63, 0])); // start of scan
  bytes.push(0x12, 0x34, 0xff, 0x00, 0x56); // pretend picture data (FF00 is a stuffed byte, not a marker)
  bytes.push(0xff, 0xd9); // end of image
  if (options.trailing) bytes.push(...text(options.trailing));
  return Uint8Array.from(bytes);
}

// ---------- PNG ----------
function pngChunk(type: string, data: number[]): number[] {
  return [...u32be(data.length), ...text(type), ...data, 0, 0, 0, 0]; // checksum left as zeros: the cleaner does not check it
}

export function aPng(options: { textSecret?: string; exifSecret?: string; trailing?: string } = {}): Uint8Array {
  const bytes: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  bytes.push(...pngChunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
  if (options.textSecret) bytes.push(...pngChunk("tEXt", [...text("Comment"), 0, ...text(options.textSecret)]));
  if (options.exifSecret) bytes.push(...pngChunk("eXIf", text(options.exifSecret)));
  bytes.push(...pngChunk("IDAT", [1, 2, 3, 4]));
  bytes.push(...pngChunk("IEND", []));
  if (options.trailing) bytes.push(...text(options.trailing));
  return Uint8Array.from(bytes);
}

// ---------- WebP ----------
function riffChunk(type: string, data: number[]): number[] {
  const chunk = [...text(type), ...u32le(data.length), ...data];
  if (data.length % 2 === 1) chunk.push(0); // chunks are padded to an even length
  return chunk;
}

export function aWebp(options: { exif?: string; xmp?: string } = {}): Uint8Array {
  const flags = (options.exif ? 0x08 : 0) | (options.xmp ? 0x04 : 0);
  const body: number[] = [
    ...text("WEBP"),
    ...riffChunk("VP8X", [flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ...riffChunk("VP8 ", [1, 2, 3, 4, 5]), // odd length on purpose, to exercise the padding
  ];
  if (options.exif) body.push(...riffChunk("EXIF", text(options.exif)));
  if (options.xmp) body.push(...riffChunk("XMP ", text(options.xmp)));
  return Uint8Array.from([...text("RIFF"), ...u32le(body.length), ...body]);
}

export function containsText(bytes: Uint8Array, value: string): boolean {
  return Buffer.from(bytes).includes(value);
}
