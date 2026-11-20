import { ApiError } from "./api-error";

// 401: the session expired or was never valid. The officer area sends the officer back to the login screen.
export function isSessionEnded(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// The 409 message comes from the API: "This report was just updated by someone else. Reload it and try again."
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function officerErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "network") return "Could not reach the server. Check the connection and try again.";
    if (error.kind === "rate_limited") return "Too many requests. Please wait a moment and try again.";
    if (error.kind === "server") return "Something went wrong on the server. Please try again in a few minutes.";
    if (error.status === 403) return "You do not have access to this report. It may be outside your areas.";
    if (error.status === 404) return "This report could not be found.";
    if (error.status === 409) return "Someone else updated this report a moment ago. It has been reloaded, so please check it and try again.";
    return error.message; // 400 / 422: the API's own explanation, written for people
  }
  return "Something went wrong. Please try again.";
}
