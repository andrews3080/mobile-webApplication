import jwt from "jsonwebtoken";
import type { TokenService } from "../application/security-ports";

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly lifetimeSeconds: number,
  ) {
    if (secret.length < 32) throw new Error("The token secret must have at least 32 characters");
  }

  issue(userId: string): string {
    return jwt.sign({}, this.secret, {
      subject: userId,
      expiresIn: this.lifetimeSeconds,
      algorithm: "HS256",
    });
  }

  verify(token: string): string | null {
    try {
      // Only HS256 is accepted, so nobody can sneak in a token signed another way
      const decoded = jwt.verify(token, this.secret, { algorithms: ["HS256"] });
      if (typeof decoded === "string") return null;
      return typeof decoded.sub === "string" ? decoded.sub : null;
    } catch {
      return null; // bad signature, expired, or garbage
    }
  }
}
