import { createHmac, timingSafeEqual } from "node:crypto";
import type { UploadSigner } from "../application/photo-ports";

// Signs "key + expiry" with a secret only the server knows. Change either part and the signature breaks.
export class HmacUploadSigner implements UploadSigner {
  constructor(private readonly secret: string) {
    if (secret.length < 32) throw new Error("The upload secret must have at least 32 characters");
  }

  sign(key: string, expiresAtMs: number): string {
    return createHmac("sha256", this.secret).update(`${key}\n${expiresAtMs}`).digest("hex");
  }

  verify(key: string, expiresAtMs: number, signature: string): boolean {
    const expected = Buffer.from(this.sign(key, expiresAtMs), "hex");
    const actual = Buffer.from(signature, "hex");
    // timingSafeEqual throws on different lengths, so compare lengths first
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
