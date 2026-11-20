import { ApiError } from "../core/errors";
import type { OfficerApi, OfficerReportSummary, OfficerReportView, ReviewAction, ReviewResult } from "../core/officer";
import { photoFileName } from "../core/officer";
import { defaultFetch, readObject, toApiError } from "./http-report-api";
import type { FetchFn } from "./http-report-api";

// Which body field each review action sends its text in (apps/api http/app.ts)
const TEXT_FIELD: Partial<Record<ReviewAction, string>> = {
  verify: "reason",
  reject: "reason",
  "request-information": "question",
};

const reportPath = (code: string) => `/api/officer/reports/${encodeURIComponent(code)}`;

function unreadable(): ApiError {
  return new ApiError("server", "The server sent an answer we could not read");
}

// Talks to the officer endpoints. Every call except login carries "Authorization: Bearer <token>".
export class HttpOfficerApi implements OfficerApi {
  constructor(
    private readonly baseUrl: string = "",
    private readonly fetchFn: FetchFn = defaultFetch,
  ) {}

  private async send(path: string, init: RequestInit, token?: string): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let response: Response;
    try {
      response = await this.fetchFn(this.baseUrl + path, { ...init, headers });
    } catch {
      throw new ApiError("network", "Could not reach the server. Check your connection.");
    }
    if (!response.ok) throw await toApiError(response);
    return response;
  }

  async login(email: string, password: string): Promise<string> {
    const response = await this.send("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const token = (await readObject(response))["token"];
    if (typeof token !== "string") throw unreadable();
    return token;
  }

  async listReports(token: string): Promise<OfficerReportSummary[]> {
    const body = await readObject(await this.send("/api/officer/reports", { method: "GET" }, token));
    if (!Array.isArray(body["reports"])) throw unreadable();
    return body["reports"] as OfficerReportSummary[];
  }

  async getReport(token: string, code: string): Promise<OfficerReportView> {
    const body = await readObject(await this.send(reportPath(code), { method: "GET" }, token));
    if (typeof body["reference"] !== "string" || !Array.isArray(body["photoKeys"])) throw unreadable();
    return body as unknown as OfficerReportView;
  }

  async getPhoto(token: string, code: string, photoKey: string): Promise<Blob> {
    const file = encodeURIComponent(photoFileName(photoKey));
    const response = await this.send(`${reportPath(code)}/photos/${file}`, { method: "GET" }, token);
    return response.blob();
  }

  async review(token: string, code: string, action: ReviewAction, text?: string): Promise<ReviewResult> {
    const field = TEXT_FIELD[action];
    const response = await this.send(
      `${reportPath(code)}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field ? { [field]: text ?? "" } : {}),
      },
      token,
    );
    const body = await readObject(response);
    if (typeof body["reference"] !== "string" || typeof body["status"] !== "string") throw unreadable();
    return { reference: body["reference"], status: body["status"] };
  }
}
