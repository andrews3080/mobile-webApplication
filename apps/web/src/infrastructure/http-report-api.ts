import { ApiError } from "../core/errors";
import type {
  PhotoUploadApi,
  PublicReportView,
  ReportSubmitApi,
  SubmitReceipt,
  SubmitRequest,
  TrackApi,
  UploadSlot,
} from "../core/ports";

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

// Careful: calling window.fetch as a method of another object throws "Illegal invocation",
// so we always wrap it in an arrow function
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

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

async function toApiError(response: Response): Promise<ApiError> {
  const message = await messageOf(response);
  if (response.status === 429) {
    const wait = Number(response.headers.get("Retry-After"));
    return new ApiError("rate_limited", message, 429, Number.isFinite(wait) && wait > 0 ? wait : undefined);
  }
  if (response.status >= 500) return new ApiError("server", message, response.status);
  return new ApiError("rejected", message, response.status);
}

function unreadable(): ApiError {
  return new ApiError("server", "The server sent an answer we could not read");
}

async function readObject(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw unreadable();
  return body as Record<string, unknown>;
}

// The ONLY place that talks to the network. Everything else uses the ports.
export class HttpReportApi implements PhotoUploadApi, ReportSubmitApi, TrackApi {
  constructor(
    private readonly baseUrl: string = "",
    private readonly fetchFn: FetchFn = defaultFetch,
  ) {}

  private async send(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(this.baseUrl + path, init);
    } catch {
      throw new ApiError("network", "Could not reach the server. Check your connection.");
    }
    if (!response.ok) throw await toApiError(response);
    return response;
  }

  async createSlot(input: { contentType: string; sizeBytes: number }): Promise<UploadSlot> {
    const response = await this.send("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await readObject(response);
    const key = body["key"];
    const uploadUrl = body["uploadUrl"];
    if (typeof key !== "string" || typeof uploadUrl !== "string") throw unreadable();
    return { key, uploadUrl };
  }

  async sendPhoto(uploadUrl: string, contentType: string, bytes: ArrayBuffer): Promise<void> {
    await this.send(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Uint8Array(bytes),
    });
  }

  async submit(idempotencyKey: string, body: SubmitRequest): Promise<SubmitReceipt> {
    const response = await this.send("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
    const result = await readObject(response);
    const reference = result["reference"];
    const alreadyReceived = result["alreadyReceived"];
    if (typeof reference !== "string" || typeof alreadyReceived !== "boolean") throw unreadable();
    return { reference, alreadyReceived };
  }

  async track(code: string): Promise<PublicReportView> {
    const response = await this.send(`/api/track/${encodeURIComponent(code)}`, { method: "GET" });
    const body = await readObject(response);
    if (typeof body["reference"] !== "string" || typeof body["status"] !== "string") throw unreadable();
    return body as unknown as PublicReportView;
  }
}
