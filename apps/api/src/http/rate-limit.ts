import type { RequestHandler } from "express";
import { TooManyRequestsError } from "../application/security-errors";
import type { RateLimiter } from "../application/security-ports";

export function rateLimit(limiter: RateLimiter): RequestHandler {
  return (req, res, next) => {
    const result = limiter.check(req.ip ?? "unknown");
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      next(new TooManyRequestsError());
      return;
    }
    next();
  };
}
