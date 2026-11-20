import { describe, it, expect } from "vitest";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { ReferenceCode } from "../../../api/src/domain/reference-code";
import { aJpeg, containsText } from "../../../api/src/test-support/fake-images";
import { setupHttp } from "../../../api/src/test-support/http-setup";
import { ApiError } from "../core/errors";
import { SubmitDraft } from "../core/submit-draft";
import { HttpReportApi } from "../infrastructure/http-report-api";
import { InMemoryDraftStore } from "../infrastructure/in-memory-draft-store";
import { aDraft, FixedClock, RecordingSleeper, toArrayBuffer } from "../test-support/fakes";

// Starts the REAL Express app (in-memory storage) on a free port, runs the test, then shuts it down
async function withServer(test: (api: HttpReportApi, ctx: Awaited<ReturnType<typeof setupHttp>>) => Promise<void>): Promise<void> {
  const ctx = await setupHttp();
  const server = ctx.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await test(new HttpReportApi(`http://127.0.0.1:${port}`), ctx);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const photoWithGps = () => ({
  id: "p1",
  contentType: "image/jpeg",
  bytes: toArrayBuffer(aJpeg({ exifSecret: "GPS-5.1234N-0.6543W" })),
});

async function errorOf(action: Promise<unknown>): Promise<ApiError> {
  try {
    await action;
  } catch (error) {
    if (error instanceof ApiError) return error;
  }
  throw new Error("Expected an ApiError");
}

describe("the web client against the real API", () => {
  it("sends a report with a photo end to end, and the photo arrives WITHOUT its location data", () =>
    withServer(async (api, ctx) => {
      const drafts = new InMemoryDraftStore();
      const useCase = new SubmitDraft(drafts, api, api, new FixedClock(), new RecordingSleeper());
      const draft = aDraft({ contactName: "Kwame Test", contactPhone: "0240000000", photos: [photoWithGps()] });
      await drafts.save(draft);

      const receipt = await useCase.execute(draft);

      expect(receipt).toEqual({ reference: "0000-0000-0001", alreadyReceived: false });
      expect(await drafts.load()).toBeNull();
      expect(ctx.repo.count()).toBe(1);

      const report = await ctx.repo.findByReference(ReferenceCode.parse(receipt.reference));
      expect(report?.contact?.phone).toBe("0240000000");
      const key = report?.photoKeys[0] ?? "";
      const stored = await ctx.photos.read(key);
      expect(stored).not.toBeNull();
      expect(containsText(stored?.bytes ?? new Uint8Array(), "GPS-5.1234N")).toBe(false);
    }));

  it("sending the same draft twice creates ONE report and returns the same code", () =>
    withServer(async (api, ctx) => {
      const useCase = new SubmitDraft(new InMemoryDraftStore(), api, api, new FixedClock(), new RecordingSleeper());
      const draft = aDraft({ photos: [photoWithGps()] });

      const first = await useCase.execute(draft);
      const second = await useCase.execute(draft); // as if the confirmation had been lost and the reporter pressed send again

      expect(second.reference).toBe(first.reference);
      expect(second.alreadyReceived).toBe(true);
      expect(ctx.repo.count()).toBe(1);
    }));

  it("lets the reporter track the report, and shows no private data", () =>
    withServer(async (api) => {
      const useCase = new SubmitDraft(new InMemoryDraftStore(), api, api, new FixedClock(), new RecordingSleeper());
      const receipt = await useCase.execute(
        aDraft({
          contactName: "Kwame Test",
          contactPhone: "0240000000",
          latitude: 5.123456,
          longitude: -0.654321,
          placeDetails: "Behind Kofi's farm, near the river bridge",
        }),
      );

      const view = await api.track(receipt.reference);

      expect(view.status).toBe("received");
      expect(view.area).toBe("Tarkwa-Nsuaem Municipal");
      expect(JSON.stringify(view)).not.toContain("Kofi"); // place details are for officers only
      const text = JSON.stringify(view);
      expect(text).not.toContain("Kwame");
      expect(text).not.toContain("0240000000");
      expect(text).not.toContain("5.123456");
    }));

  it("shows the server's message when it rejects a report (422)", () =>
    withServer(async (api) => {
      const error = await errorOf(
        api.submit("key-0123456789abcdef", { description: "short", category: "river_pollution", observedAt: "2026-11-14T08:00:00.000Z", area: "Sample Community", photoKeys: [] }),
      );
      expect(error.kind).toBe("rejected");
      expect(error.status).toBe(422);
    }));

  it("says rejected (404) for an unknown tracking code", () =>
    withServer(async (api) => {
      const error = await errorOf(api.track("CCCC-CCCC-CCCC"));
      expect(error.kind).toBe("rejected");
      expect(error.status).toBe(404);
    }));

  it("reports a network error when the server cannot be reached", async () => {
    const api = new HttpReportApi("http://127.0.0.1:1"); // nothing listens on port 1
    expect((await errorOf(api.track("ABCD-EFGH-JKMN"))).kind).toBe("network");
  });
});
