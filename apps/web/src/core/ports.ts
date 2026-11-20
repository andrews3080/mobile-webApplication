import type { ReportDraft } from "./report-draft";

// What the API accepts and returns, as the client sees it
export interface SubmitRequest {
  description: string;
  category: string;
  observedAt: string;
  area: string;
  latitude?: number;
  longitude?: number;
  photoKeys: string[];
  contact?: { name?: string; phone?: string; email?: string };
}

export interface SubmitReceipt {
  reference: string; // the reporter's tracking code, XXXX-XXXX-XXXX
  alreadyReceived: boolean; // true when this was a retry of an earlier send
}

export interface UploadSlot {
  key: string; // what the report refers to
  uploadUrl: string; // where the bytes go
}

export interface PublicReportView {
  reference: string;
  status: string;
  category: string;
  area: string;
  submittedAt: string;
  updatedAt: string;
  photoCount: number;
  timeline: { status: string; at: string }[];
}

// PORTS: what the logic needs from the outside world. Small, one per job (Interface Segregation).

export interface DraftStore {
  load(): Promise<ReportDraft | null>;
  save(draft: ReportDraft): Promise<void>;
  clear(): Promise<void>;
}

export interface PhotoUploadApi {
  createSlot(input: { contentType: string; sizeBytes: number }): Promise<UploadSlot>;
  sendPhoto(uploadUrl: string, contentType: string, bytes: ArrayBuffer): Promise<void>;
}

export interface ReportSubmitApi {
  submit(idempotencyKey: string, body: SubmitRequest): Promise<SubmitReceipt>;
}

export interface TrackApi {
  track(code: string): Promise<PublicReportView>;
}

export interface Clock {
  now(): Date;
}

export interface Sleeper {
  sleep(milliseconds: number): Promise<void>;
}

export interface IdGenerator {
  next(): string;
}

// A photo ready to go into the draft: re-encoded (which also drops hidden metadata such as GPS) and small enough
export interface PreparedImage {
  contentType: string;
  bytes: ArrayBuffer;
}

export interface ImageCompressor {
  // Throws when the file is not a picture the browser can read
  compress(file: Blob, maxBytes: number): Promise<PreparedImage>;
}

export interface MapPosition {
  latitude: number;
  longitude: number;
}

export interface LocationFinder {
  // Throws LocationUnavailableError when the phone cannot or will not say where it is
  current(): Promise<MapPosition>;
}
