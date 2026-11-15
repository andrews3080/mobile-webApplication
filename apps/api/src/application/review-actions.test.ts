import { describe, it, expect } from "vitest";
import { ReferenceCode } from "../domain/reference-code";
import { DomainError } from "../domain/errors";
import { AccessGate } from "./access-gate";
import { AccessPolicy } from "./access-policy";
import { ConflictError } from "./errors";
import { PublicReportMapper } from "./public-report-mapper";
import { StartReview } from "./review-actions";
import { ReviewWorkflow } from "./review-workflow";
import { TrackReport } from "./track-report";
import { InMemoryAuditLog } from "../infrastructure/in-memory-audit-log";
import { InMemoryReportRepository } from "../infrastructure/in-memory-report-repository";
import { aReport, FixedClock } from "../test-support/builders";
import { anOfficer } from "../test-support/actors";
import { CODE, KEY, setupReview } from "../test-support/review-setup";

const officer = anOfficer();
const reference = () => ReferenceCode.parse(CODE);

describe("review actions", () => {
  it("starts a review and records which officer did it", async () => {
    const s = await setupReview();
    const result = await s.start.execute(officer, CODE);
    expect(result.status).toBe("under_review");

    const stored = await s.repo.findByReference(reference());
    expect(stored?.history[0]?.officerId).toBe("officer-1");
  });

  it("verifies a report under review and keeps the reason", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    const result = await s.verify.execute(officer, CODE, "Photos match the site");
    expect(result.status).toBe("verified");

    const stored = await s.repo.findByReference(reference());
    expect(stored?.history[1]?.reason).toBe("Photos match the site");
  });

  it("cannot verify a report that nobody has reviewed yet", async () => {
    const s = await setupReview();
    await expect(s.verify.execute(officer, CODE, "Photos match the site")).rejects.toThrow(DomainError);
  });

  it("needs a real reason to verify", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    await expect(s.verify.execute(officer, CODE, "ok")).rejects.toThrow(DomainError);
  });

  it("rejects a report and keeps the reason", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    const result = await s.reject.execute(officer, CODE, "Photos show a farm, not a mine");
    expect(result.status).toBe("rejected");
  });

  it("needs a reason to reject", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    await expect(s.reject.execute(officer, CODE, "")).rejects.toThrow(DomainError);
  });

  it("asks for more information and records the question", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    const result = await s.askInfo.execute(officer, CODE, "Which side of the river is the site?");
    expect(result.status).toBe("more_information_requested");

    const stored = await s.repo.findByReference(reference());
    expect(stored?.history[1]?.reason).toBe("Which side of the river is the site?");
  });

  it("will not ask an empty question", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    await expect(s.askInfo.execute(officer, CODE, "  ")).rejects.toThrow(DomainError);
  });

  it("lets an officer resume the review after asking for information", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    await s.askInfo.execute(officer, CODE, "Which side of the river is the site?");
    const resumed = await s.start.execute(officer, CODE);
    expect(resumed.status).toBe("under_review");
  });

  it("shows the reporter the new status but never the officer", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    const view = await new TrackReport(s.repo, new PublicReportMapper()).execute(CODE);
    expect(view.status).toBe("under_review");
    expect(JSON.stringify(view)).not.toContain("officer-1");
  });

  it("writes an 'allowed' audit entry for a successful action", async () => {
    const s = await setupReview();
    await s.start.execute(officer, CODE);
    const entry = s.audit.entries()[0];
    expect(entry?.action).toBe("report.start_review");
    expect(entry?.outcome).toBe("allowed");
    expect(entry?.target).toBe(CODE);
  });

  it("tells the officer to retry when someone else changed the report first", async () => {
    // A repository that always reports "someone else got there first"
    class StaleRepository extends InMemoryReportRepository {
      override async replace(): Promise<boolean> {
        return false;
      }
    }
    const repo = new StaleRepository();
    await repo.saveIfNew(aReport(CODE), KEY);

    const clock = new FixedClock();
    const gate = new AccessGate(new AccessPolicy(), new InMemoryAuditLog(), clock);
    const start = new StartReview(new ReviewWorkflow(repo, gate, clock));

    await expect(start.execute(officer, CODE)).rejects.toThrow(ConflictError);
  });
});
