import { randomInt } from "node:crypto";
import { REFERENCE_ALPHABET, REFERENCE_LENGTH, ReferenceCode } from "../domain/reference-code";
import type { ReferenceGenerator } from "../application/ports";

// Uses the operating system's secure random source, NOT Math.random(),
// because this code is the reporter's only password for tracking.
export class RandomReferenceGenerator implements ReferenceGenerator {
  next(): ReferenceCode {
    let raw = "";
    for (let i = 0; i < REFERENCE_LENGTH; i++) {
      raw += REFERENCE_ALPHABET.charAt(randomInt(REFERENCE_ALPHABET.length));
    }
    return ReferenceCode.parse(raw);
  }
}
