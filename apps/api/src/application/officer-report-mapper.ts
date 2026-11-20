import type { Contact, Report, ReportCategory } from "../domain/report";
import type { ReportStatus } from "../domain/status";

// The full report as an officer sees it. JSON-friendly: no classes, no undefined.
export interface OfficerReportView {
  reference: string;
  status: ReportStatus;
  category: ReportCategory;
  description: string;
  observedAt: string;
  submittedAt: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  placeDetails: string | null;
  photoKeys: string[];
  contact: Contact | null;
  replies: { answer: string; at: string }[]; // the reporter's answers to officers' questions
  history: {
    from: ReportStatus;
    to: ReportStatus;
    officerId: string;
    reason: string | null;
    at: string;
  }[];
}

export class OfficerReportMapper {
  toView(report: Report): OfficerReportView {
    return {
      reference: report.reference.toString(),
      status: report.status,
      category: report.category,
      description: report.description,
      observedAt: report.observedAt.toISOString(),
      submittedAt: report.createdAt.toISOString(),
      area: report.location.area,
      latitude: report.location.latitude ?? null,
      longitude: report.location.longitude ?? null,
      placeDetails: report.location.placeDetails ?? null,
      photoKeys: [...report.photoKeys],
      contact: report.contact ?? null,
      replies: report.replies.map((reply) => ({ answer: reply.answer, at: reply.at.toISOString() })),
      history: report.history.map((event) => ({
        from: event.from,
        to: event.to,
        officerId: event.officerId,
        reason: event.reason ?? null,
        at: event.at.toISOString(),
      })),
    };
  }
}
