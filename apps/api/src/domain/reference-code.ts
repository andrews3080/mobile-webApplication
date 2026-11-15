import { DomainError } from "./errors";

// 32 characters with no I, L, O or U, so codes are hard to misread or mistype.
// The code generator (infrastructure layer) will reuse these two constants.
export const REFERENCE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const REFERENCE_LENGTH = 12; // 32^12 = 60 bits of randomness, so not guessable

// Value object for the tracking code an anonymous reporter keeps.
// It is their only "password", so it must be long and random (decision D1).
export class ReferenceCode {
  private constructor(private readonly raw: string) {}

  static parse(input: string): ReferenceCode {
    const cleaned = (input ?? "")
      .toUpperCase()
      .replace(/[\s-]/g, "") // ignore spaces and dashes
      .replace(/O/g, "0") // friendly fixes for common typing mistakes
      .replace(/[IL]/g, "1");

    if (cleaned.length !== REFERENCE_LENGTH) {
      throw new DomainError(`Reference code must have ${REFERENCE_LENGTH} characters`);
    }
    for (const char of cleaned) {
      if (!REFERENCE_ALPHABET.includes(char)) {
        throw new DomainError("Reference code contains an invalid character");
      }
    }
    return new ReferenceCode(cleaned);
  }

  // Display format: XXXX-XXXX-XXXX
  toString(): string {
    return `${this.raw.slice(0, 4)}-${this.raw.slice(4, 8)}-${this.raw.slice(8, 12)}`;
  }

  equals(other: ReferenceCode): boolean {
    return this.raw === other.raw;
  }
}
