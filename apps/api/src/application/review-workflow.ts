import type { Actor } from "../domain/actor";
import type { ReportStatus } from "../domain/status";
import type { AccessGate } from "./access-gate";
import { ConflictError } from "./errors";
import { loadReport } from "./load-report";
import type { Clock, ReportFinder, ReportReviewStore } from "./ports";

export interface ReviewResult {
  reference: string;
  status: ReportStatus;
}

// The steps every review action shares: load, check access, change status, save safely.
// The small use cases in review-actions.ts only choose WHICH status to move to.
export class ReviewWorkflow {
  constructor(
    private readonly repo: ReportFinder & ReportReviewStore,
    private readonly gate: AccessGate,
    private readonly clock: Clock,
  ) {}

  async apply(
    actor: Actor,
    code: string,
    next: ReportStatus,
    action: string,
    reason?: string,
  ): Promise<ReviewResult> {
    const found = await loadReport(this.repo, code);
    const report = await this.gate.requireForReport(actor, action, found);

    // The domain enforces the status rules and the "reason required" rules
    const updated = report.transitionTo(next, actor.id, this.clock.now(), reason);

    // Save only if nobody changed the report since we read it
    const saved = await this.repo.replace(updated, report.status);
    if (!saved) throw new ConflictError();

    return { reference: updated.reference.toString(), status: updated.status };
  }
}
