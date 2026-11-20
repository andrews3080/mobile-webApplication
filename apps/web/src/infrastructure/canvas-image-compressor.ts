import type { ImageCompressor, PreparedImage } from "../core/ports";

const START_LONGEST_SIDE = 1600; // plenty for an officer to see what is in the picture
const QUALITIES = [0.8, 0.65, 0.5, 0.4];
const SHRINK_STEP = 0.75; // when every quality is still too big, make the picture smaller and try again
const SMALLEST_SIDE = 400;

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the picture"))), "image/jpeg", quality);
  });
}

// Redraws the picture on a canvas and saves it as JPEG. Redrawing keeps only the pixels,
// so hidden metadata (GPS position, phone model) never leaves the device. The server strips it again anyway.
// Browser-only: it needs a real canvas, so it is checked by hand in the browser, not in unit tests.
export class CanvasImageCompressor implements ImageCompressor {
  async compress(file: Blob, maxBytes: number): Promise<PreparedImage> {
    // "from-image" turns phone photos the right way up before we draw them
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      let longest = Math.min(START_LONGEST_SIDE, Math.max(bitmap.width, bitmap.height));
      let smallest: Blob | null = null;

      for (;;) {
        const scale = longest / Math.max(bitmap.width, bitmap.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser cannot draw pictures");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        for (const quality of QUALITIES) {
          const blob = await toBlob(canvas, quality);
          if (blob.size <= maxBytes) return { contentType: "image/jpeg", bytes: await blob.arrayBuffer() };
          if (!smallest || blob.size < smallest.size) smallest = blob;
        }

        if (longest <= SMALLEST_SIDE) break;
        longest = Math.max(SMALLEST_SIDE, Math.round(longest * SHRINK_STEP));
      }

      // Still too big: hand back the smallest try and let the caller decide (it will refuse it)
      return { contentType: "image/jpeg", bytes: await smallest!.arrayBuffer() };
    } finally {
      bitmap.close();
    }
  }
}
