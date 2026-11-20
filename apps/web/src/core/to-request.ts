import type { ReportDraft } from "./report-draft";
import type { SubmitRequest } from "./ports";

// Turns the draft into exactly what the API expects. Blank contact fields mean "no contact".
export function toSubmitRequest(draft: ReportDraft, photoKeys: string[]): SubmitRequest {
  const name = draft.contactName.trim();
  const phone = draft.contactPhone.trim();
  const email = draft.contactEmail.trim();
  const hasContact = name.length > 0 || phone.length > 0 || email.length > 0;

  return {
    description: draft.description.trim(),
    category: draft.category,
    observedAt: new Date(draft.observedAt).toISOString(),
    area: draft.area,
    placeDetails: draft.placeDetails.trim() || undefined,
    latitude: draft.latitude,
    longitude: draft.longitude,
    photoKeys,
    contact: hasContact ? { name: name || undefined, phone: phone || undefined, email: email || undefined } : undefined,
  };
}
