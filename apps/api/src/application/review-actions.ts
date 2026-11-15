import type { Actor } from "../domain/actor";
import type { ReviewResult, ReviewWorkflow } from "./review-workflow";

// Four small use cases. Each only decides which status to move to.

export class StartReview {
  constructor(private readonly workflow: ReviewWorkflow) {}
  execute(actor: Actor, code: string): Promise<ReviewResult> {
    return this.workflow.apply(actor, code, "under_review", "report.start_review");
  }
}

export class VerifyReport {
  constructor(private readonly workflow: ReviewWorkflow) {}
  execute(actor: Actor, code: string, reason: string): Promise<ReviewResult> {
    return this.workflow.apply(actor, code, "verified", "report.verify", reason);
  }
}

export class RejectReport {
  constructor(private readonly workflow: ReviewWorkflow) {}
  execute(actor: Actor, code: string, reason: string): Promise<ReviewResult> {
    return this.workflow.apply(actor, code, "rejected", "report.reject", reason);
  }
}

export class RequestMoreInformation {
  constructor(private readonly workflow: ReviewWorkflow) {}
  // For now the question is stored as the reason in the report history
  execute(actor: Actor, code: string, question: string): Promise<ReviewResult> {
    return this.workflow.apply(actor, code, "more_information_requested", "report.request_information", question);
  }
}
