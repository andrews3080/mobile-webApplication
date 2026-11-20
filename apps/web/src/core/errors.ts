// ApiError is shared with the mobile app
export { ApiError, isRetryable } from "@asaase-ani/shared";
export type { ApiErrorKind } from "@asaase-ani/shared";

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
