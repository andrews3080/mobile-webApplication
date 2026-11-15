import { Report } from "../domain/report";
import type { NewReportInput } from "../domain/report";
import { Location } from "../domain/location";
import { ReferenceCode } from "../domain/reference-code";
import type { Clock, Notifier, ReferenceGenerator } from "../application/ports";

export const NOW = new Date("2026-11-14T10:00:00Z");
export const LATER = new Date("2026-11-14T11:00:00Z");

// A clock that always says the same time, so tests are predictable
export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = NOW) {}
  now(): Date {
    return this.fixed;
  }
}

// Hands out 0000-0000-0001, 0000-0000-0002, ... so tests know the codes in advance
export class SequenceReferenceGenerator implements ReferenceGenerator {
  private n = 0;
  next(): ReferenceCode {
    this.n += 1;
    return ReferenceCode.parse(String(this.n).padStart(12, "0"));
  }
}

// Remembers who was notified instead of sending anything
export class RecordingNotifier implements Notifier {
  readonly sent: Report[] = [];
  async notifyNewReport(report: Report): Promise<void> {
    this.sent.push(report);
  }
}

// A valid report that individual tests can tweak
export function aReport(
  code = "ABCD-EFGH-JKMN",
  overrides: Partial<NewReportInput> = {},
  now: Date = NOW,
): Report {
  return Report.create(
    {
      reference: ReferenceCode.parse(code),
      description: "Muddy water and diggers near the river bank",
      category: "river_pollution",
      observedAt: new Date("2026-11-14T08:00:00Z"),
      location: Location.create({ area: "Sample Community" }),
      ...overrides,
    },
    now,
  );
}
