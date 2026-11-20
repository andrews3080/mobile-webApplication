// What the officer screens work with. Mirrors the API's officer views (apps/api application/*-mapper.ts).

export interface OfficerReportSummary {
  reference: string;
  status: string;
  category: string;
  area: string;
  submittedAt: string;
}

export interface OfficerReportView {
  reference: string;
  status: string;
  category: string;
  description: string;
  observedAt: string;
  submittedAt: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  photoKeys: string[];
  contact: { name?: string; phone?: string; email?: string } | null;
  history: { from: string; to: string; officerId: string; reason: string | null; at: string }[];
}

export type ReviewAction = "start-review" | "verify" | "reject" | "request-information" | "refer-for-action" | "close";

export interface ReviewResult {
  reference: string;
  status: string;
}

// PORTS
export interface OfficerApi {
  login(email: string, password: string): Promise<string>; // returns the session token
  listReports(token: string): Promise<OfficerReportSummary[]>;
  getReport(token: string, code: string): Promise<OfficerReportView>;
  getPhoto(token: string, code: string, photoKey: string): Promise<Blob>;
  review(token: string, code: string, action: ReviewAction, text?: string): Promise<ReviewResult>;
}

export interface TokenStore {
  load(): string | null;
  save(token: string): void;
  clear(): void;
}

// ---------- Review rules ----------

export interface ActionInfo {
  action: ReviewAction;
  label: string;
  tone: "primary" | "positive" | "danger" | "neutral";
  // When set, the action opens a text box first; the officer must fill it unless it is optional
  text?: { label: string; hint: string; optional?: boolean };
}

const ACTIONS: Record<ReviewAction, ActionInfo> = {
  "start-review": { action: "start-review", label: "Start review", tone: "primary" },
  verify: {
    action: "verify",
    label: "Confirm report",
    tone: "positive",
    text: { label: "Why is this confirmed?", hint: "For example what was checked and seen. Kept in the report history." },
  },
  reject: {
    action: "reject",
    label: "Do not confirm",
    tone: "danger",
    text: { label: "Why can it not be confirmed?", hint: "Kept in the report history. The reporter does not see it." },
  },
  "request-information": {
    action: "request-information",
    label: "Ask for more information",
    tone: "neutral",
    text: { label: "What do you need to know?", hint: "Kept in the report history. If the reporter left contact details, use them to ask." },
  },
  "refer-for-action": {
    action: "refer-for-action",
    label: "Pass on for action",
    tone: "primary",
    text: { label: "Who was it passed to?", hint: "For example the agency or task force, and how. Kept in the report history." },
  },
  close: {
    action: "close",
    label: "Close report",
    tone: "neutral",
    text: { label: "Closing note", hint: "Optional. For example what was done. Kept in the report history.", optional: true },
  },
};

// Same moves the API allows (apps/api domain/status.ts). The server still decides; this only hides buttons that would fail.
export function actionsFor(status: string): ActionInfo[] {
  switch (status) {
    case "received":
    case "more_information_requested":
      return [ACTIONS["start-review"]];
    case "under_review":
      return [ACTIONS.verify, ACTIONS.reject, ACTIONS["request-information"]];
    case "verified":
      return [ACTIONS["refer-for-action"], ACTIONS.close];
    case "rejected":
    case "referred_for_action":
      return [ACTIONS.close];
    default:
      return [];
  }
}

export const MIN_REASON_LENGTH = 5; // the API refuses shorter reasons

export function checkReason(text: string): string | null {
  const length = text.trim().length;
  if (length === 0) return "Please write a reason before continuing.";
  if (length < MIN_REASON_LENGTH) return `Please write a little more (at least ${MIN_REASON_LENGTH} characters).`;
  return null;
}

// "photos/abc.jpg" -> "abc.jpg", the last part of the officer photo address
export function photoFileName(photoKey: string): string {
  return photoKey.replace(/^photos\//, "");
}
