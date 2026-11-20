import { isKnownArea, regionOfArea } from "@asaase-ani/shared";

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
  region: string; // one of the 16 regions
  area: string; // a district of that region, or its "District not known, <Region>" area: decides which officers see it
  placeDetails: string; // town, community or landmark in the reporter's words: officers only, never public
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  photos: DraftPhoto[];
  updatedAt: string;
}

// Drafts saved on a phone before the district list existed had a free-text "area".
// Keep what the reporter typed by moving it into the place details, and ask for the district again.
export function upgradeDraft(saved: ReportDraft): ReportDraft {
  const draft = { ...saved, region: saved.region ?? "", placeDetails: saved.placeDetails ?? "" };
  if (draft.area && !isKnownArea(draft.area)) {
    return { ...draft, placeDetails: draft.placeDetails || draft.area, area: "" };
  }
  if (draft.area && !draft.region) return { ...draft, region: regionOfArea(draft.area) ?? "" };
  return draft;
}

export function newDraft(id: string, idempotencyKey: string, now: Date): ReportDraft {
  return {
    id,
    idempotencyKey,
    description: "",
    category: "",
    observedAt: now.toISOString(),
    region: "",
    area: "",
    placeDetails: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    photos: [],
    updatedAt: now.toISOString(),
  };
}
