import type { Actor } from "../domain/actor";
import type { Report } from "../domain/report";
import { sameArea } from "../domain/area";

export type Decision = { allowed: true } | { allowed: false; reason: string };

const ALLOWED: Decision = { allowed: true };

function deny(reason: string): Decision {
  return { allowed: false, reason };
}

// ALL access rules live in this one class. Pure logic: no database, no logging, no throwing.
export class AccessPolicy {
  // Can this person work with reports at all?
  canWorkWithReports(actor: Actor): Decision {
    if (!actor.active) return deny("account is disabled");
    // Administrators manage accounts. They do not read or review reports (least privilege).
    if (actor.role !== "officer") return deny("role is not allowed to work with reports");
    return ALLOWED;
  }

  // Can this person see or review THIS report?
  canAccessReport(actor: Actor, report: Report): Decision {
    const base = this.canWorkWithReports(actor);
    if (!base.allowed) return base;
    const inArea = actor.areas.some((area) => sameArea(area, report.location.area));
    return inArea ? ALLOWED : deny("report is outside the officer's areas");
  }
}
