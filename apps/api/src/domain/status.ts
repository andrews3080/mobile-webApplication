// The life of a report, exactly as described in Milestone 1
export const REPORT_STATUSES = [
  "received",
  "under_review",
  "more_information_requested",
  "verified",
  "rejected",
  "referred_for_action",
  "closed",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

// Allowed moves. A status missing from a list means "not allowed".
// Note: "received" cannot jump straight to "verified". An officer must review first.
const ALLOWED: Record<ReportStatus, readonly ReportStatus[]> = {
  received: ["under_review"],
  under_review: ["more_information_requested", "verified", "rejected"],
  more_information_requested: ["under_review"],
  verified: ["referred_for_action", "closed"],
  rejected: ["closed"],
  referred_for_action: ["closed"],
  closed: [],
};

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return ALLOWED[from].includes(to);
}

// Verifying or rejecting must always come with a recorded reason (Milestone 1, section 3.2)
export const STATUSES_REQUIRING_REASON: readonly ReportStatus[] = ["verified", "rejected", "more_information_requested"];

