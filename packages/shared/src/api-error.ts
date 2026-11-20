export type ApiErrorKind =
  | "network" // could not reach the server at all
  | "rate_limited" // 429, too many requests
  | "server" // 5xx, the server had a problem
  | "rejected"; // other 4xx: the server understood and said no (retrying will not help)

// The one error type both clients use for anything that went wrong talking to the API
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Only problems that can go away on their own are worth retrying
export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === "network" || error.kind === "rate_limited" || error.kind === "server");
}
