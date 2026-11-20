import { regionOfArea } from "@asaase-ani/shared";
import type { MapPosition } from "./ports";
import type { DraftPhoto, ReportDraft } from "./report-draft";

// Small, pure changes to a draft. Each returns a NEW draft with a fresh updatedAt, so React sees the change.

export type TextField = "description" | "category" | "area" | "placeDetails" | "contactName" | "contactPhone" | "contactEmail";

// A new region empties the district unless it belongs to that region
export function setRegion(draft: ReportDraft, region: string, now: Date): ReportDraft {
  const keepArea = draft.area !== "" && regionOfArea(draft.area) === region;
  return { ...draft, region, area: keepArea ? draft.area : "", updatedAt: now.toISOString() };
}

export function setText(draft: ReportDraft, field: TextField, value: string, now: Date): ReportDraft {
  return { ...draft, [field]: value, updatedAt: now.toISOString() };
}

export function setObservedAt(draft: ReportDraft, iso: string, now: Date): ReportDraft {
  return { ...draft, observedAt: iso, updatedAt: now.toISOString() };
}

export function setPosition(draft: ReportDraft, position: MapPosition, now: Date): ReportDraft {
  return { ...draft, latitude: position.latitude, longitude: position.longitude, updatedAt: now.toISOString() };
}

export function clearPosition(draft: ReportDraft, now: Date): ReportDraft {
  const { latitude: _latitude, longitude: _longitude, ...rest } = draft;
  return { ...rest, updatedAt: now.toISOString() };
}

export function addPhoto(draft: ReportDraft, photo: DraftPhoto, now: Date): ReportDraft {
  return { ...draft, photos: [...draft.photos, photo], updatedAt: now.toISOString() };
}

export function removePhoto(draft: ReportDraft, photoId: string, now: Date): ReportDraft {
  return { ...draft, photos: draft.photos.filter((photo) => photo.id !== photoId), updatedAt: now.toISOString() };
}

// <input type="datetime-local"> speaks LOCAL time without a zone ("2026-11-14T09:30").
// The draft keeps an ISO instant. These two convert between them.
const pad = (n: number) => n.toString().padStart(2, "0");

export function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Returns "" when the input is empty or not a date, which the validator then reports
export function fromLocalInputValue(value: string): string {
  if (value.trim() === "") return "";
  const date = new Date(value); // a zoneless date-time string is read as local time
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
