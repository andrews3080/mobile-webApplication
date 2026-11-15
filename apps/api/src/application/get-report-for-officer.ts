import type { Actor } from "../domain/actor";
import type { Report } from "../domain/report";
import type { AccessGate } from "./access-gate";
import { loadReport } from "./load-report";
import type { ReportFinder } from "./ports";

// Returns the FULL internal report (including contact details) to an officer in the right area.
// The API layer will turn it into a response object later.
export class GetReportForOfficer {
  constructor(
    private readonly repo: ReportFinder,
    private readonly gate: AccessGate,
  ) {}

  async execute(actor: Actor, code: string): Promise<Report> {
    const found = await loadReport(this.repo, code);
    return this.gate.requireForReport(actor, "report.view", found);
  }
}
