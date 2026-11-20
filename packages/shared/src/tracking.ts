import { REPORT_CATEGORIES } from "./categories";

// Mirrors the API's ReferenceCode rules (apps/api domain/reference-code.ts). The server checks again.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O or U
const LENGTH = 12;

export type CodeCheck = { ok: true; code: string } | { ok: false; problem: string };

// Forgives what people actually type: lower case, spaces, dashes, O for zero, I or L for one
export function checkTrackingCode(input: string): CodeCheck {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  if (cleaned.length === 0) return { ok: false, problem: "Please enter your tracking code." };
  if ([...cleaned].some((char) => !ALPHABET.includes(char))) {
    return { ok: false, problem: "A tracking code only has letters and numbers. Please check it." };
  }
  if (cleaned.length !== LENGTH) {
    return { ok: false, problem: `A tracking code has ${LENGTH} letters and numbers. Yours has ${cleaned.length}.` };
  }
  return { ok: true, code: `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}` };
}

export type StatusTone = "progress" | "positive" | "attention" | "neutral";

export interface StatusInfo {
  label: string;
  explanation: string;
  tone: StatusTone;
}

// What each status means for the person who reported, in plain words
const STATUS_INFO: Record<string, StatusInfo> = {
  received: {
    label: "Received",
    explanation: "Your report has arrived safely. An officer will look at it soon.",
    tone: "progress",
  },
  under_review: {
    label: "Being checked",
    explanation: "An officer is checking your report now.",
    tone: "progress",
  },
  more_information_requested: {
    label: "More information needed",
    explanation: "The officer needs more details. If you gave contact details, they may get in touch with you.",
    tone: "attention",
  },
  verified: {
    label: "Confirmed",
    explanation: "Officers have confirmed what you reported. Thank you.",
    tone: "positive",
  },
  rejected: {
    label: "Not confirmed",
    explanation: "Officers could not confirm this report. Thank you for taking the time to report.",
    tone: "neutral",
  },
  referred_for_action: {
    label: "Passed on for action",
    explanation: "Your report has been passed to the people who can act on it.",
    tone: "positive",
  },
  closed: {
    label: "Closed",
    explanation: "Work on this report has finished. Thank you for reporting.",
    tone: "neutral",
  },
};

export function describeStatus(status: string): StatusInfo {
  // An unknown status (a newer server) still shows something sensible instead of breaking the page
  return STATUS_INFO[status] ?? { label: status.replace(/_/g, " "), explanation: "", tone: "neutral" };
}

export function categoryLabel(value: string): string {
  return REPORT_CATEGORIES.find((category) => category.value === value)?.label ?? value.replace(/_/g, " ");
}
