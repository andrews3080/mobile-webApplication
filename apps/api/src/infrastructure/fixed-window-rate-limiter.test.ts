import { describe, it, expect } from "vitest";
import { FixedWindowRateLimiter } from "./fixed-window-rate-limiter";
import { MutableClock } from "../test-support/mutable-clock";

describe("FixedWindowRateLimiter", () => {
  it("allows requests up to the limit, then refuses with a wait time", () => {
    const limiter = new FixedWindowRateLimiter(new MutableClock(), 3, 60_000);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    const refused = limiter.check("a");
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(60);
  });

  it("starts counting again after the window passes", () => {
    const clock = new MutableClock();
    const limiter = new FixedWindowRateLimiter(clock, 1, 60_000);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    clock.advance(60_001);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("counts each key separately", () => {
    const limiter = new FixedWindowRateLimiter(new MutableClock(), 1, 60_000);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("tells the caller how long is left", () => {
    const clock = new MutableClock();
    const limiter = new FixedWindowRateLimiter(clock, 1, 60_000);
    limiter.check("a");
    clock.advance(45_000);
    expect(limiter.check("a").retryAfterSeconds).toBe(15);
  });
});
