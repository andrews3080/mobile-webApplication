import type { Report } from "../domain/report";
import type { ReferenceCode } from "../domain/reference-code";
import type { ReportStatus } from "../domain/status";
import { sameArea } from "../domain/area";
import type { ReportRepository } from "../application/ports";

// Stores reports in memory. Perfect for tests and for developing before the database exists.
export class InMemoryReportRepository implements ReportRepository {
  private readonly reports = new Map<string, Report>(); // reference text -> current report
  private readonly keyToReference = new Map<string, string>(); // idempotency key -> reference text

  async saveIfNew(report: Report, idempotencyKey: string): Promise<{ report: Report; created: boolean }> {
    const existingRef = this.keyToReference.get(idempotencyKey);
    if (existingRef !== undefined) {
      const existing = this.reports.get(existingRef);
      if (existing) return { report: existing, created: false };
    }

    const referenceText = report.reference.toString();
    if (this.reports.has(referenceText)) {
      throw new Error("Reference code collision");
    }

    this.reports.set(referenceText, report);
    this.keyToReference.set(idempotencyKey, referenceText);
    return { report, created: true };
  }

  async findByReference(reference: ReferenceCode): Promise<Report | null> {
    return this.reports.get(reference.toString()) ?? null;
  }

  async listByAreas(areas: readonly string[]): Promise<Report[]> {
    return [...this.reports.values()].filter((report) =>
      areas.some((area) => sameArea(area, report.location.area)),
    );
  }

  async replace(report: Report, expectedStatus: ReportStatus): Promise<boolean> {
    const key = report.reference.toString();
    const stored = this.reports.get(key);
    if (!stored || stored.status !== expectedStatus) return false;
    this.reports.set(key, report);
    return true;
  }

  // Handy for tests only. Not part of any port.
  count(): number {
    return this.reports.size;
  }
}
