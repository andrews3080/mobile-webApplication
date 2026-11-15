import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { PasswordHasher } from "../application/security-ports";

const KEY_LENGTH = 64;
const FAKE_SALT = Buffer.alloc(16);

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

// scrypt is deliberately slow, which makes guessing passwords expensive.
// Stored format: scrypt$<salt in hex>$<key in hex>
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16); // a fresh salt each time, so equal passwords give different hashes
    const key = await derive(password, salt);
    return ["scrypt", salt.toString("hex"), key.toString("hex")].join("$");
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [scheme, saltHex, keyHex, ...extra] = storedHash.split("$");
    if (scheme !== "scrypt" || !saltHex || !keyHex || extra.length > 0) {
      // Unknown user or broken hash: do the same slow work anyway,
      // so response time does not reveal which emails exist
      await derive(password, FAKE_SALT);
      return false;
    }
    const expected = Buffer.from(keyHex, "hex");
    const actual = await derive(password, Buffer.from(saltHex, "hex"));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
