import type { Actor } from "../domain/actor";
import type { Report } from "../domain/report";
import type { AccessPolicy, Decision } from "./access-policy";
import { ForbiddenError, NotFoundError } from "./errors";
import type { AuditLog, Clock } from "./ports";

// Asks the policy, writes the audit entry (for refusals too), and throws when refused.
// Every officer use case goes through here, so nothing can skip the audit log.
export class AccessGate {
  constructor(
    private readonly policy: AccessPolicy,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async requireToList(actor: Actor, action: string): Promise<void> {
    const decision = this.policy.canWorkWithReports(actor);
    await this.record(actor, action, undefined, decision);
    if (!decision.allowed) throw new ForbiddenError();
  }

  // "found" is the report that was looked up, or null when the code matched nothing
  async requireForReport(actor: Actor, action: string, found: Report | null): Promise<Report> {
    if (found === null) {
      const actorDecision = this.policy.canWorkWithReports(actor);
      if (actorDecision.allowed) {
        await this.record(actor, action, undefined, { allowed: false, reason: "report not found" });
        throw new NotFoundError();
      }
      // A refused person gets "not allowed" even for unknown codes,
      // so they cannot use us to find out which codes exist
      await this.record(actor, action, undefined, actorDecision);
      throw new ForbiddenError();
    }

    const decision = this.policy.canAccessReport(actor, found);
    await this.record(actor, action, found.reference.toString(), decision);
    if (!decision.allowed) throw new ForbiddenError();
    return found;
  }

  private record(actor: Actor, action: string, target: string | undefined, decision: Decision): Promise<void> {
    return this.audit.record({
      actorId: actor.id,
      action,
      target,
      outcome: decision.allowed ? "allowed" : "denied",
      detail: decision.allowed ? undefined : decision.reason,
      at: this.clock.now(),
    });
  }
}
