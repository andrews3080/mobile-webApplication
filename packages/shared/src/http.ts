import { ApiError } from "./api-error";

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

// Careful: calling window.fetch as a method of another object throws "Illegal invocation",
// so we always wrap it in an arrow function
export const defaultFetch: FetchFn = (input, init) => fetch(input, init);

// The server always answers errors as { error: { code, message } }
async function messageOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = (body as { error: unknown }).error;
      if (typeof error === "object" && error !== null && "message" in error) {
        const message = (error as { message: unknown }).message;
        if (typeof message === "string") return message;
      }
    }
  } catch {
    // the body was not JSON, so use the generic message below
  }
  return `The server answered with status ${response.status}`;
}

export async function toApiError(response: Response): Promise<ApiError> {
  const message = await messageOf(response);
  if (response.status === 429) {
    const wait = Number(response.headers.get("Retry-After"));
    return new ApiError("rate_limited", message, 429, Number.isFinite(wait) && wait > 0 ? wait : undefined);
  }
  if (response.status >= 500) return new ApiError("server", message, response.status);
  return new ApiError("rejected", message, response.status);
}

export function unreadable(): ApiError {
  return new ApiError("server", "The server sent an answer we could not read");
}

export async function readObject(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw unreadable();
  return body as Record<string, unknown>;
}
