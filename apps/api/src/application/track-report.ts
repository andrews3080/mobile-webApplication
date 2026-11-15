import { DomainError } from "../domain/errors";
import { ReferenceCode } from "../domain/reference-code";
import { NotFoundError } from "./errors";
import type { ReportFinder } from "./ports";
import type { PublicReportMapper, PublicReportView } from "./public-report-mapper";

export class TrackReport {
  constructor(
    private readonly repo: ReportFinder,
    private readonly mapper: PublicReportMapper,
  ) {}

  async execute(code: string): Promise<PublicReportView> {
    let reference: ReferenceCode;
    try {
      reference = ReferenceCode.parse(code);
    } catch (error) {
      // A badly formed code and an unknown code must look exactly the same from outside,
      // otherwise people could learn what a valid code looks like
      if (error instanceof DomainError) throw new NotFoundError();
      throw error;
    }

    const report = await this.repo.findByReference(reference);
    if (!report) throw new NotFoundError();

    return this.mapper.toView(report); // never return the raw Report
  }
}

