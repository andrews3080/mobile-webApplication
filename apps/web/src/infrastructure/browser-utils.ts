import type { IdGenerator, Sleeper } from "../core/ports";

// 128 random bits as 32 hex characters. Uses getRandomValues (not randomUUID) because
// randomUUID only exists on secure pages, which would break testing from a phone over plain http.
export class BrowserIdGenerator implements IdGenerator {
  next(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
}

export class RealSleeper implements Sleeper {
  sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
