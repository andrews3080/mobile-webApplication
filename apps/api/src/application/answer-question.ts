import { DomainError } from "../domain/errors";
import { ReferenceCode } from "../domain/reference-code";
import { ConflictError, NotFoundError } from "./errors";
import type { Clock, Notifier, ReportFinder, ReportReviewStore } from "./ports";
import type { PublicReportMapper, PublicReportView } from "./public-report-mapper";

// An anonymous reporter answers an officer's question from the tracking page.
// Knowing the tracking code is what proves they are the reporter, exactly as for tracking.
export class AnswerQuestion {
  constructor(
    private readonly repo: ReportFinder & ReportReviewStore,
    private readonly mapper: PublicReportMapper,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
  ) {}

  async execute(code: string, answer: string): Promise<PublicReportView> {
    let reference: ReferenceCode;
    try {
      reference = ReferenceCode.parse(code);
    } catch (error) {
      if (error instanceof DomainError) throw new NotFoundError(); // same answer as an unknown code
      throw error;
    }

    const report = await this.repo.findByReference(reference);
    if (!report) throw new NotFoundError();

    const updated = report.answerQuestion(answer, this.clock.now());

    // Saved only if the report did not change meanwhile (an officer may have resumed the review)
    const saved = await this.repo.replace(updated, report.status);
    if (!saved) throw new ConflictError("This report was just updated. Please reload the page.");

    // A failed notification must not lose the answer, which is already saved
    await this.notifier.notifyReporterAnswered(updated).catch(() => undefined);
    return this.mapper.toView(updated);
  }
}
