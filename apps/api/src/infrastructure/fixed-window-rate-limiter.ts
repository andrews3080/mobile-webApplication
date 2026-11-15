import type { Clock, } from "../application/ports";
import type { RateLimiter, RateLimitResult } from "../application/security-ports";

interface Window {
  count: number;
  resetAt: number; // milliseconds
}

// Allows `limit` requests per key in each time window.
// Lives in memory, so it suits ONE server. With several servers it moves to a shared store.
export class FixedWindowRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly clock: Clock,
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.clock.now().getTime();
    this.sweep(now);

    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }

    if (window.count >= this.limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000) };
    }
    window.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Stops the map from growing forever
  private sweep(now: number): void {
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
