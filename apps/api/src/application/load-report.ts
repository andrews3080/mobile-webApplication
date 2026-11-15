import { DomainError } from "../domain/errors";
import { ReferenceCode } from "../domain/reference-code";
import type { Report } from "../domain/report";
import type { ReportFinder } from "./ports";

// Turns what an officer typed into a report, or null if the code is malformed or unknown
export async function loadReport(finder: ReportFinder, code: string): Promise<Report | null> {
  let reference: ReferenceCode;
  try {
    reference = ReferenceCode.parse(code);
  } catch (error) {
    if (error instanceof DomainError) return null;
    throw error;
  }
  return finder.findByReference(reference);
}
