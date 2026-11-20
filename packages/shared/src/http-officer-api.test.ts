import { describe, it, expect } from "vitest";
import { HttpOfficerApi } from "./http-officer-api";
import type { FetchFn } from "./http";

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function apiWith(handler: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: FetchFn = async (input, init) => {
    calls.push({ url: input, init: init ?? {} });
    return handler(input, init ?? {});
  };
  return { api: new HttpOfficerApi("", fetchFn), calls };
}

const header = (init: RequestInit | undefined, name: string) => new Headers(init?.headers).get(name);

describe("HttpOfficerApi", () => {
  it("logs in without a token and returns the new one", async () => {
    const { api, calls } = apiWith(() => respond(200, { token: "t-123" }));
    expect(await api.login("officer@example.com", "secret")).toBe("t-123");
    expect(calls[0]?.url).toBe("/api/auth/login");
    expect(header(calls[0]?.init, "Authorization")).toBeNull();
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ email: "officer@example.com", password: "secret" });
  });

  it("sends the token with every officer request", async () => {
    const { api, calls } = apiWith(() => respond(200, { reports: [] }));
    await api.listReports("t-123");
    expect(header(calls[0]?.init, "Authorization")).toBe("Bearer t-123");
  });

  it("asks for a photo by its file name under the report", async () => {
    const { api, calls } = apiWith(() => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/jpeg" } }));
    const blob = await api.getPhoto("t", "ABCD-EFGH-JKMN", "photos/abc.jpg");
    expect(calls[0]?.url).toBe("/api/officer/reports/ABCD-EFGH-JKMN/photos/abc.jpg");
    expect(blob.size).toBe(3);
  });

  it("sends the reason or question in the field each action expects", async () => {
    const { api, calls } = apiWith(() => respond(200, { reference: "ABCD-EFGH-JKMN", status: "verified" }));
    await api.review("t", "ABCD-EFGH-JKMN", "verify", "Seen on site");
    await api.review("t", "ABCD-EFGH-JKMN", "request-information", "Which bank of the river?");
    await api.review("t", "ABCD-EFGH-JKMN", "start-review");
    expect(calls.map((c) => c.url)).toEqual([
      "/api/officer/reports/ABCD-EFGH-JKMN/verify",
      "/api/officer/reports/ABCD-EFGH-JKMN/request-information",
      "/api/officer/reports/ABCD-EFGH-JKMN/start-review",
    ]);
    expect(calls.map((c) => JSON.parse(String(c.init.body)))).toEqual([{ reason: "Seen on site" }, { question: "Which bank of the river?" }, {}]);
  });

  it("sends a referral note, and an empty body when closing without a note", async () => {
    const { api, calls } = apiWith(() => respond(200, { reference: "ABCD-EFGH-JKMN", status: "closed" }));
    await api.review("t", "ABCD-EFGH-JKMN", "refer-for-action", "District task force");
    await api.review("t", "ABCD-EFGH-JKMN", "close");
    await api.review("t", "ABCD-EFGH-JKMN", "close", "   ");
    expect(calls.map((c) => c.url.split("/").pop())).toEqual(["refer-for-action", "close", "close"]);
    expect(calls.map((c) => JSON.parse(String(c.init.body)))).toEqual([{ note: "District task force" }, {}, {}]);
  });

  it("reports an expired session as a 401 rejection", async () => {
    const { api } = apiWith(() => respond(401, { error: { code: "unauthorized", message: "You need to log in" } }));
    await expect(api.listReports("old")).rejects.toMatchObject({ kind: "rejected", status: 401 });
  });
});
