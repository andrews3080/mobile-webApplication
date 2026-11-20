import { ApiError, defaultFetch, readObject, toApiError, unreadable } from "@asaase-ani/shared";
import type { FetchFn } from "@asaase-ani/shared";
import type {
  PhotoUploadApi,
  PublicReportView,
  ReportSubmitApi,
  SubmitReceipt,
  SubmitRequest,
  TrackApi,
  UploadSlot,
} from "../core/ports";

export type { FetchFn } from "@asaase-ani/shared";

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

  async answer(code: string, answer: string): Promise<PublicReportView> {
    const response = await this.send(`/api/track/${encodeURIComponent(code)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const body = await readObject(response);
    if (typeof body["reference"] !== "string" || typeof body["status"] !== "string") throw unreadable();
    return body as unknown as PublicReportView;
  }
}
