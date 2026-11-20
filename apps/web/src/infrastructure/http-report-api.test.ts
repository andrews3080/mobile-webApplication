import { describe, it, expect } from "vitest";
import { ApiError } from "../core/errors";
import { HttpReportApi } from "./http-report-api";
import type { FetchFn } from "./http-report-api";

function respond(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

// An API wired to a pretend network. Records every call so tests can check what was sent.
function apiWith(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: FetchFn = async (input, init) => {
    calls.push({ url: input, init: init ?? {} });
    return handler(input, init ?? {});
  };
  return { api: new HttpReportApi("http://api.test", fetchFn), calls };
}

async function errorOf(action: Promise<unknown>): Promise<ApiError> {
  try {
    await action;
  } catch (error) {
    if (error instanceof ApiError) return error;
  }
  throw new Error("Expected an ApiError");
}

const REQUEST = { description: "Muddy water near the river", category: "river_pollution", observedAt: "2026-11-14T08:00:00.000Z", area: "Sample Community", photoKeys: [] };

describe("HttpReportApi", () => {
  it("asks for an upload slot with a JSON body", async () => {
    const { api, calls } = apiWith(() => respond(201, { key: "photos/a.jpg", uploadUrl: "/api/uploads/a.jpg?expires=1&sig=x" }));
    const slot = await api.createSlot({ contentType: "image/jpeg", sizeBytes: 1234 });
    expect(slot).toEqual({ key: "photos/a.jpg", uploadUrl: "/api/uploads/a.jpg?expires=1&sig=x" });
    expect(calls[0]?.url).toBe("http://api.test/api/uploads");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ contentType: "image/jpeg", sizeBytes: 1234 });
  });

  it("sends the photo bytes with PUT and the right content type", async () => {
    const { api, calls } = apiWith(() => respond(201, { key: "photos/a.jpg", sizeBytes: 3 }));
    await api.sendPhoto("/api/uploads/a.jpg?expires=1&sig=x", "image/jpeg", Uint8Array.from([1, 2, 3]).buffer);
    expect(calls[0]?.url).toBe("http://api.test/api/uploads/a.jpg?expires=1&sig=x");
    expect(calls[0]?.init.method).toBe("PUT");
    expect(new Headers(calls[0]?.init.headers).get("Content-Type")).toBe("image/jpeg");
    expect((calls[0]?.init.body as Uint8Array).byteLength).toBe(3);
  });

  it("sends the report with the Idempotency-Key header", async () => {
    const { api, calls } = apiWith(() => respond(201, { reference: "ABCD-EFGH-JKMN", alreadyReceived: false }));
    const receipt = await api.submit("key-0123456789abcdef", REQUEST);
    expect(receipt).toEqual({ reference: "ABCD-EFGH-JKMN", alreadyReceived: false });
    expect(new Headers(calls[0]?.init.headers).get("Idempotency-Key")).toBe("key-0123456789abcdef");
    expect(JSON.parse(String(calls[0]?.init.body)).category).toBe("river_pollution");
  });

  it("treats 200 (a retry the server already had) as success", async () => {
    const { api } = apiWith(() => respond(200, { reference: "ABCD-EFGH-JKMN", alreadyReceived: true }));
    expect((await api.submit("key-0123456789abcdef", REQUEST)).alreadyReceived).toBe(true);
  });

  it("turns a 422 into a rejected error carrying the server's message", async () => {
    const { api } = apiWith(() => respond(422, { error: { code: "validation_failed", message: "Description is too short" } }));
    const error = await errorOf(api.submit("key-0123456789abcdef", REQUEST));
    expect(error.kind).toBe("rejected");
    expect(error.status).toBe(422);
    expect(error.message).toBe("Description is too short");
  });

  it("turns a 429 into rate_limited with the wait time from Retry-After", async () => {
    const { api } = apiWith(() => respond(429, { error: { code: "too_many_requests", message: "Slow down" } }, { "Retry-After": "7" }));
    const error = await errorOf(api.createSlot({ contentType: "image/jpeg", sizeBytes: 10 }));
    expect(error.kind).toBe("rate_limited");
    expect(error.retryAfterSeconds).toBe(7);
  });

  it("turns a 500 into a server error, even when the body is not JSON", async () => {
    const { api } = apiWith(() => new Response("<html>oops</html>", { status: 500 }));
    const error = await errorOf(api.submit("key-0123456789abcdef", REQUEST));
    expect(error.kind).toBe("server");
    expect(error.message).toContain("500");
  });

  it("turns a failed connection into a network error", async () => {
    const api = new HttpReportApi("http://api.test", async () => {
      throw new TypeError("fetch failed");
    });
    expect((await errorOf(api.submit("key-0123456789abcdef", REQUEST))).kind).toBe("network");
  });

  it("refuses an answer it cannot understand", async () => {
    const { api } = apiWith(() => respond(201, { something: "else" }));
    expect((await errorOf(api.submit("key-0123456789abcdef", REQUEST))).kind).toBe("server");
  });

  it("encodes the tracking code in the address", async () => {
    const { api, calls } = apiWith(() => respond(200, { reference: "ABCD-EFGH-JKMN", status: "received" }));
    await api.track("abcd efgh/jkmn");
    expect(calls[0]?.url).toBe("http://api.test/api/track/abcd%20efgh%2Fjkmn");
  });
});

describe("HttpReportApi answers", () => {
  it("posts the answer to the report's tracking address", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const api = new HttpReportApi("", async (url, init) => {
      calls.push({ url, init: init ?? {} });
      return new Response(JSON.stringify({ reference: "ABCD-EFGH-JKMN", status: "more_information_requested" }), { status: 200 });
    });
    await api.answer("ABCD-EFGH-JKMN", "The east bank");
    expect(calls[0]?.url).toBe("/api/track/ABCD-EFGH-JKMN/answer");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ answer: "The east bank" });
  });
});
