import type { UserAccount } from "../domain/user-account";

export interface UserFinder {
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(id: string): Promise<UserAccount | null>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, storedHash: string): Promise<boolean>;
}

// The token holds only the user id. Role and areas are always re-read, so changes apply at once.
export interface TokenService {
  issue(userId: string): string;
  verify(token: string): string | null; // the user id, or null when the token is not valid
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}
