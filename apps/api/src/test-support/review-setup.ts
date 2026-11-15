import { AccessGate } from "../application/access-gate";
import { AccessPolicy } from "../application/access-policy";
import { GetReportForOfficer } from "../application/get-report-for-officer";
import { ListReportsForOfficer } from "../application/list-reports-for-officer";
import { RejectReport, RequestMoreInformation, StartReview, VerifyReport } from "../application/review-actions";
import { ReviewWorkflow } from "../application/review-workflow";
import { InMemoryAuditLog } from "../infrastructure/in-memory-audit-log";
import { InMemoryReportRepository } from "../infrastructure/in-memory-report-repository";
import { aReport, FixedClock } from "./builders";

export const CODE = "ABCD-EFGH-JKMN";
export const KEY = "11111111-2222-3333-4444-555555555555";

// Wires every officer use case to in-memory parts and stores ONE report (status: received)
export async function setupReview() {
  const repo = new InMemoryReportRepository();
  const audit = new InMemoryAuditLog();
  const clock = new FixedClock();
  const gate = new AccessGate(new AccessPolicy(), audit, clock);
  const workflow = new ReviewWorkflow(repo, gate, clock);

  await repo.saveIfNew(aReport(CODE), KEY);

  return {
    repo,
    audit,
    list: new ListReportsForOfficer(repo, gate),
    get: new GetReportForOfficer(repo, gate),
    start: new StartReview(workflow),
    verify: new VerifyReport(workflow),
    reject: new RejectReport(workflow),
    askInfo: new RequestMoreInformation(workflow),
  };
}

export type ReviewSetup = Awaited<ReturnType<typeof setupReview>>;
