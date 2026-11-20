import { BrowserIdGenerator, RealSleeper } from "../infrastructure/browser-utils";
import { BrowserLocationFinder } from "../infrastructure/browser-location-finder";
import { CanvasImageCompressor } from "../infrastructure/canvas-image-compressor";
import { HttpOfficerApi } from "@asaase-ani/shared";
import { HttpReportApi } from "../infrastructure/http-report-api";
import { IndexedDbDraftStore } from "../infrastructure/indexed-db-draft-store";
import { SessionTokenStore } from "../infrastructure/token-stores";
import type { AppServices } from "../ui/App";

// Composition root for the browser: the ONLY place that picks the real implementations
export function createBrowserServices(): AppServices {
  const api = new HttpReportApi();
  return {
    tracking: api,
    officer: new HttpOfficerApi(),
    officerTokens: new SessionTokenStore(),
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
