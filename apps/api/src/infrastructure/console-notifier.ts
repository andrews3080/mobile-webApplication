import type { Report } from "../domain/report";
import type { Notifier } from "../application/ports";

// Placeholder until push notifications exist (Step 7). Logs the reference and area only,
// never the description or contact details.
export class ConsoleNotifier implements Notifier {
  async notifyNewReport(report: Report): Promise<void> {
    console.log(`[notify] new report ${report.reference.toString()} in ${report.location.area}`);
  }

  async notifyReporterAnswered(report: Report): Promise<void> {
    console.log(`[notify] reporter answered on ${report.reference.toString()} in ${report.location.area}`);
  }
}
