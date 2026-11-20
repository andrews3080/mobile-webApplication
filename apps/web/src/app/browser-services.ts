import { BrowserIdGenerator, RealSleeper } from "../infrastructure/browser-utils";
import { BrowserLocationFinder } from "../infrastructure/browser-location-finder";
import { CanvasImageCompressor } from "../infrastructure/canvas-image-compressor";
import { HttpReportApi } from "../infrastructure/http-report-api";
import { IndexedDbDraftStore } from "../infrastructure/indexed-db-draft-store";
import type { ReportServices } from "../ui/services";

// Composition root for the browser: the ONLY place that picks the real implementations
export function createBrowserServices(): ReportServices {
  const api = new HttpReportApi();
  return {
    drafts: new IndexedDbDraftStore(),
    photos: api,
    reports: api,
    compressor: new CanvasImageCompressor(),
    location: new BrowserLocationFinder(),
    clock: { now: () => new Date() },
    ids: new BrowserIdGenerator(),
    sleeper: new RealSleeper(),
  };
}
