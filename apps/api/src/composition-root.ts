import { AccessGate } from "./application/access-gate";
import { AccessPolicy } from "./application/access-policy";
import { GetReportForOfficer } from "./application/get-report-for-officer";
import { ListReportsForOfficer } from "./application/list-reports-for-officer";
import { LoginOfficer } from "./application/login-officer";
import { OfficerReportMapper } from "./application/officer-report-mapper";
import type { AuditLog, Clock, Notifier, ReferenceGenerator, ReportRepository } from "./application/ports";
import { PublicReportMapper } from "./application/public-report-mapper";
import { RejectReport, RequestMoreInformation, StartReview, VerifyReport } from "./application/review-actions";
import { ReviewWorkflow } from "./application/review-workflow";
import type { PasswordHasher, TokenService, UserFinder } from "./application/security-ports";
import { SubmitReport } from "./application/submit-report";
import { TrackReport } from "./application/track-report";

// Everything the outside world supplies. Swap any of these without touching the use cases.
export interface Parts {
  repo: ReportRepository;
  audit: AuditLog;
  users: UserFinder;
  hasher: PasswordHasher;
  tokens: TokenService;
  refs: ReferenceGenerator;
  notifier: Notifier;
  clock: Clock;
}

// THE composition root: the only place that connects use cases to concrete parts.
export function wire(parts: Parts) {
  const gate = new AccessGate(new AccessPolicy(), parts.audit, parts.clock);
  const workflow = new ReviewWorkflow(parts.repo, gate, parts.clock);

  return {
    submitReport: new SubmitReport(parts.repo, parts.refs, parts.notifier, parts.clock),
    trackReport: new TrackReport(parts.repo, new PublicReportMapper()),
    login: new LoginOfficer(parts.users, parts.hasher, parts.tokens),
    listReports: new ListReportsForOfficer(parts.repo, gate),
    getReport: new GetReportForOfficer(parts.repo, gate),
    startReview: new StartReview(workflow),
    verifyReport: new VerifyReport(workflow),
    rejectReport: new RejectReport(workflow),
    requestInformation: new RequestMoreInformation(workflow),
    officerMapper: new OfficerReportMapper(),
    tokens: parts.tokens,
    users: parts.users,
  };
}

export type Services = ReturnType<typeof wire>;
