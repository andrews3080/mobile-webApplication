// Categories are shared with the mobile app
export { REPORT_CATEGORIES } from "@asaase-ani/shared";

export const MAX_PHOTOS = 5;

// A photo waiting inside the draft. We keep the raw bytes so it survives a refresh or a lost connection.
export interface DraftPhoto {
  id: string;
  contentType: string;
  bytes: ArrayBuffer;
  uploadedKey?: string; // set once the server has the photo, so we never upload it twice
}

// Everything the reporter has typed so far. Text fields stay plain strings so a form can bind to them.
export interface ReportDraft {
  id: string;
  idempotencyKey: string; // created ONCE per draft and reused on every retry (no duplicates)
  description: string;
  category: string;
  observedAt: string; // date and time as ISO text
  area: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  photos: DraftPhoto[];
  updatedAt: string;
}

export function newDraft(id: string, idempotencyKey: string, now: Date): ReportDraft {
  return {
    id,
    idempotencyKey,
    description: "",
    category: "",
    observedAt: now.toISOString(),
    area: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    photos: [],
    updatedAt: now.toISOString(),
  };
}
