import type { Report, ReportCategory } from "../domain/report";
import type { ReportStatus } from "../domain/status";

// Exactly what a PUBLIC tracking page may show. Nothing else gets out.
export interface PublicReportView {
  reference: string;
  status: ReportStatus;
  category: ReportCategory;
  area: string;
  submittedAt: string;
  updatedAt: string;
  photoCount: number;
  timeline: { status: ReportStatus; at: string }[];
}

// Builds the view field by field. A new Report field can NEVER leak by accident,
// because it only appears here if someone adds it on purpose (decision D4).
export class PublicReportMapper {
  toView(report: Report): PublicReportView {
    const timeline = [
      { status: "received" as ReportStatus, at: report.createdAt.toISOString() },
      ...report.history.map((event) => ({ status: event.to, at: event.at.toISOString() })),
    ];
    const last = timeline[timeline.length - 1];

    return {
      reference: report.reference.toString(),
      status: report.status,
      category: report.category,
      area: report.location.toPublicArea(), // area only, never coordinates
      submittedAt: report.createdAt.toISOString(),
      updatedAt: last ? last.at : report.createdAt.toISOString(),
      photoCount: report.photoKeys.length,
      timeline, // statuses and times only, no officer ids and no reasons
    };
  }
}
