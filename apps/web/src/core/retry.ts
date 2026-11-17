import { ApiError, isRetryable } from "./errors";
import type { Sleeper } from "./ports";

export interface RetryOptions {
  attempts: number; // total tries, including the first
  baseDelayMs: number; // first wait, then doubled each time
  sleeper: Sleeper;
}

const MAX_WAIT_MS = 30_000;

// Tries again after short, growing pauses (exponential backoff).
// Only retries problems that can go away on their own. Gives up at once on "no".
export async function withRetry<T>(action: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (!isRetryable(error) || attempt >= options.attempts) throw error;

      // When the server says how long to wait (429), listen to it
      const requested = error instanceof ApiError && error.retryAfterSeconds !== undefined ? error.retryAfterSeconds * 1000 : undefined;
      const wait = requested ?? options.baseDelayMs * 2 ** (attempt - 1);
      await options.sleeper.sleep(Math.min(wait, MAX_WAIT_MS));
    }
  }
}
