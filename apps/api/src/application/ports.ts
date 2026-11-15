import type { Report } from "../domain/report";
import type { ReferenceCode } from "../domain/reference-code";
import type { ReportStatus } from "../domain/status";

// Small interfaces, one per kind of user (Interface Segregation).
// Each use case depends only on the one it needs.

export interface ReportSubmissionStore {
  // Saves the report unless this idempotency key was already used.
  // If it was, returns the CURRENT version of the original report with created = false.
  saveIfNew(report: Report, idempotencyKey: string): Promise<{ report: Report; created: boolean }>;
}

export interface ReportFinder {
  findByReference(reference: ReferenceCode): Promise<Report | null>;
}

export interface ReportReviewStore {
  listByAreas(areas: readonly string[]): Promise<Report[]>;
  // Saves the updated report ONLY if the stored status is still expectedStatus.
  // Returns false when someone else changed it first, or when the report does not exist.
  replace(report: Report, expectedStatus: ReportStatus): Promise<boolean>;
}

// A full repository implements all three
export interface ReportRepository extends ReportSubmissionStore, ReportFinder, ReportReviewStore {}

export interface ReferenceGenerator {
  next(): ReferenceCode;
}

export interface Notifier {
  notifyNewReport(report: Report): Promise<void>;
}

export interface Clock {
  now(): Date;
}

// One line of the audit log. Never put report content or contact details in here.
export interface AuditEntry {
  actorId: string;
  action: string; // for example "report.verify"
  target?: string; // the reference code, when there is one
  outcome: "allowed" | "denied";
  detail?: string; // why it was denied
  at: Date;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}
