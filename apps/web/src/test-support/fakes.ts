import { ApiError, LocationUnavailableError } from "../core/errors";
import type {
  Clock,
  IdGenerator,
  ImageCompressor,
  LocationFinder,
  MapPosition,
  PhotoUploadApi,
  PreparedImage,
  PublicReportView,
  TrackApi,
  ReportSubmitApi,
  Sleeper,
  SubmitReceipt,
  SubmitRequest,
  UploadSlot,
} from "../core/ports";
import type { DraftPhoto, ReportDraft } from "../core/report-draft";

export const NOW = new Date("2026-11-14T10:00:00Z");

export class FixedClock implements Clock {
  now(): Date {
    return NOW;
  }
}

// Records the waits instead of really waiting, so retry tests run instantly
export class RecordingSleeper implements Sleeper {
  readonly waits: number[] = [];
  async sleep(milliseconds: number): Promise<void> {
    this.waits.push(milliseconds);
  }
}

export class SequenceIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return this.n.toString(16).padStart(32, "0");
  }
}

export const networkError = () => new ApiError("network", "offline");
export const serverError = () => new ApiError("server", "boom", 500);
export const rejectedError = () => new ApiError("rejected", "no", 422);

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function aPhoto(id = "photo-1"): DraftPhoto {
  return { id, contentType: "image/jpeg", bytes: toArrayBuffer(Uint8Array.from([1, 2, 3])) };
}

// A valid draft that tests can tweak
export function aDraft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return {
    id: "draft-1",
    idempotencyKey: "key-0123456789abcdef",
    description: "Muddy water and diggers near the river bank",
    category: "river_pollution",
    observedAt: "2026-11-14T08:00:00.000Z",
    area: "Sample Community",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    photos: [],
    updatedAt: "2026-11-14T09:00:00.000Z",
    ...overrides,
  };
}

// A photo API that always works, unless the test queues failures with failNext()
export class FakePhotoApi implements PhotoUploadApi {
  readonly slots: { contentType: string; sizeBytes: number }[] = [];
  readonly sent: { uploadUrl: string; contentType: string; size: number }[] = [];
  private readonly failures: Error[] = [];

  failNext(...errors: Error[]): void {
    this.failures.push(...errors);
  }

  async createSlot(input: { contentType: string; sizeBytes: number }): Promise<UploadSlot> {
    this.slots.push(input);
    const id = this.slots.length.toString(16).padStart(32, "0");
    return { key: `photos/${id}.jpg`, uploadUrl: `/api/uploads/${id}.jpg?expires=1&sig=x` };
  }

  async sendPhoto(uploadUrl: string, contentType: string, bytes: ArrayBuffer): Promise<void> {
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.sent.push({ uploadUrl, contentType, size: bytes.byteLength });
  }
}

export class FakeReportApi implements ReportSubmitApi {
  readonly submitted: { key: string; body: SubmitRequest }[] = [];
  private readonly failures: Error[] = [];

  failNext(...errors: Error[]): void {
    this.failures.push(...errors);
  }

  async submit(key: string, body: SubmitRequest): Promise<SubmitReceipt> {
    this.submitted.push({ key, body }); // counts every attempt, even failed ones
    const failure = this.failures.shift();
    if (failure) throw failure;
    return { reference: "ABCD-EFGH-JKMN", alreadyReceived: false };
  }
}

// Pretends to shrink pictures. Records the size limit it was given on each call.
export class FakeCompressor implements ImageCompressor {
  readonly calls: number[] = [];
  failOn?: number; // 1-based call number that throws, as if the file were broken
  outputSize = 3;

  async compress(_file: Blob, maxBytes: number): Promise<PreparedImage> {
    this.calls.push(maxBytes);
    if (this.failOn === this.calls.length) throw new Error("cannot decode");
    return { contentType: "image/jpeg", bytes: new ArrayBuffer(this.outputSize) };
  }
}

export class FakeLocationFinder implements LocationFinder {
  constructor(private readonly position: MapPosition | null = { latitude: 5.3, longitude: -1.98 }) {}

  async current(): Promise<MapPosition> {
    if (!this.position) throw new LocationUnavailableError();
    return this.position;
  }
}

export function aPublicReport(overrides: Partial<PublicReportView> = {}): PublicReportView {
  return {
    reference: "ABCD-EFGH-JKMN",
    status: "under_review",
    category: "river_pollution",
    area: "Sample Community",
    submittedAt: "2026-11-14T08:00:00.000Z",
    updatedAt: "2026-11-15T09:30:00.000Z",
    photoCount: 2,
    timeline: [
      { status: "received", at: "2026-11-14T08:00:00.000Z" },
      { status: "under_review", at: "2026-11-15T09:30:00.000Z" },
    ],
    ...overrides,
  };
}

// Knows one report. Any other code answers like the real API: 404, the same for unknown and malformed codes.
export class FakeTrackApi implements TrackApi {
  readonly asked: string[] = [];
  failure?: Error;

  constructor(private readonly report: PublicReportView = aPublicReport()) {}

  async track(code: string): Promise<PublicReportView> {
    this.asked.push(code);
    if (this.failure) throw this.failure;
    if (code !== this.report.reference) throw new ApiError("rejected", "Not found", 404);
    return this.report;
  }
}
