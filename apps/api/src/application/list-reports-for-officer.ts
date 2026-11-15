import type { Actor } from "../domain/actor";
import type { ReportCategory } from "../domain/report";
import type { ReportStatus } from "../domain/status";
import type { AccessGate } from "./access-gate";
import type { ReportReviewStore } from "./ports";

// What an officer sees in the list. No description and no contact details.
export interface OfficerReportSummary {
  reference: string;
  status: ReportStatus;
  category: ReportCategory;
  area: string;
  submittedAt: string;
}

export class ListReportsForOfficer {
  constructor(
    private readonly repo: ReportReviewStore,
    private readonly gate: AccessGate,
  ) {}

  async execute(actor: Actor, filter: { status?: ReportStatus } = {}): Promise<OfficerReportSummary[]> {
    await this.gate.requireToList(actor, "reports.list");

    const reports = await this.repo.listByAreas(actor.areas);
    return reports
      .filter((report) => !filter.status || report.status === filter.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // newest first
      .map((report) => ({
        reference: report.reference.toString(),
        status: report.status,
        category: report.category,
        area: report.location.area,
        submittedAt: report.createdAt.toISOString(),
      }));
  }
}
