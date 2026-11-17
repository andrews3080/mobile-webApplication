import { randomBytes } from "node:crypto";
import type { IdGenerator } from "../application/photo-ports";

export class RandomIdGenerator implements IdGenerator {
  next(): string {
    return randomBytes(16).toString("hex"); // 128 bits, so photo keys cannot be guessed
  }
}
