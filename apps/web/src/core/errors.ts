export type ApiErrorKind =
  | "network" // could not reach the server at all
  | "rate_limited" // 429, too many requests
  | "server" // 5xx, the server had a problem
  | "rejected"; // other 4xx: the server understood and said no (retrying will not help)

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

// The draft has problems the reporter must fix first. Nothing was sent.
export class DraftInvalidError extends Error {
  constructor(readonly problems: Record<string, string>) {
    super("The report needs a few fixes before it can be sent");
    this.name = "DraftInvalidError";
  }
}

export class DraftStorageFullError extends Error {
  constructor() {
    super("There is no space left on this device to save your draft. Free some space and try again.");
    this.name = "DraftStorageFullError";
  }
}

export class LocationUnavailableError extends Error {
  constructor(message = "We could not get your position. You can still send the report with a place name.") {
    super(message);
    this.name = "LocationUnavailableError";
  }
}
