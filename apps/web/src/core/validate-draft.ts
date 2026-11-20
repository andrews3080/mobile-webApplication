import { isGhanaRegion, regionOfArea } from "@asaase-ani/shared";
import { MAX_PHOTOS, REPORT_CATEGORIES } from "./report-draft";

export const MAX_PLACE_DETAILS = 200; // the API refuses longer
import type { ReportDraft } from "./report-draft";

export type DraftField =
  | "description"
  | "category"
  | "observedAt"
  | "region"
  | "area"
  | "placeDetails"
  | "location"
  | "contactPhone"
  | "contactEmail"
  | "photos";

export type DraftProblems = Partial<Record<DraftField, string>>;

const CLOCK_SKEW_MS = 5 * 60 * 1000; // phone clocks can be a few minutes ahead

// The same rules the server enforces, so reporters see problems at once, in plain language.
// The server stays the authority: it checks everything again.
export function validateDraft(draft: ReportDraft, now: Date): DraftProblems {
  const problems: DraftProblems = {};

  const description = draft.description.trim();
  if (description.length < 10) problems.description = "Please describe what you saw (at least 10 characters).";
  else if (description.length > 2000) problems.description = "Please keep the description under 2000 characters.";

  if (!REPORT_CATEGORIES.some((category) => category.value === draft.category)) {
    problems.category = "Please choose what you saw.";
  }

  const observed = new Date(draft.observedAt);
  if (Number.isNaN(observed.getTime())) problems.observedAt = "Please say when you saw this.";
  else if (observed.getTime() > now.getTime() + CLOCK_SKEW_MS) problems.observedAt = "The date and time cannot be in the future.";

  if (!isGhanaRegion(draft.region)) {
    problems.region = "Please choose the region.";
  } else if (regionOfArea(draft.area) !== draft.region) {
    problems.area = "Please choose the district, or choose “I don't know the district”.";
  }
  if (draft.placeDetails.trim().length > MAX_PLACE_DETAILS) {
    problems.placeDetails = `Please keep the town or landmark under ${MAX_PLACE_DETAILS} characters.`;
  }

  const { latitude, longitude } = draft;
  if ((latitude === undefined) !== (longitude === undefined)) {
    problems.location = "The map position is incomplete. Try again or clear it.";
  } else if (latitude !== undefined && longitude !== undefined) {
    const valid =
      Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    if (!valid) problems.location = "That map position is not valid.";
  }

  const phone = draft.contactPhone.trim();
  if (phone.length > 0 && !/^\+?[0-9\s-]{9,15}$/.test(phone)) problems.contactPhone = "That phone number does not look right.";

  const email = draft.contactEmail.trim();
  if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.contactEmail = "That email address does not look right.";

  if (draft.photos.length > MAX_PHOTOS) problems.photos = `You can add up to ${MAX_PHOTOS} photos.`;

  return problems;
}
