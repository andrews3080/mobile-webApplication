import { describe, it, expect } from "vitest";
import { isKnownArea } from "@asaase-ani/shared";
import { PublicReportMapper } from "../application/public-report-mapper";
import { SAMPLE_COUNT, SAMPLE_LABEL, sampleReports } from "./sample-reports";

const NOW = new Date("2026-11-22T10:00:00Z");
const samples = sampleReports(NOW);
const reports = samples.map((s) => s.report);

describe("synthetic sample reports", () => {
  it("makes 200 reports with unique codes and idempotency keys", () => {
    expect(samples).toHaveLength(SAMPLE_COUNT);
    expect(new Set(reports.map((r) => r.reference.toString())).size).toBe(SAMPLE_COUNT);
    expect(new Set(samples.map((s) => s.idempotencyKey)).size).toBe(SAMPLE_COUNT);
  });

  it("is the same every time, so seeding twice adds nothing", () => {
    const again = sampleReports(NOW);
    expect(again.map((s) => s.idempotencyKey)).toEqual(samples.map((s) => s.idempotencyKey));
  });

  it("labels every report as a sample and uses only reserved test contact details", () => {
    for (const report of reports) {
      expect(report.description.startsWith(SAMPLE_LABEL)).toBe(true);
      if (report.contact?.email) expect(report.contact.email).toMatch(/@example\.com$/);
      if (report.contact?.phone) expect(report.contact.phone).toMatch(/^0200000\d{3}$/);
    }
  });

  it("uses only areas from the district list", () => {
    for (const report of reports) expect(isKnownArea(report.location.area)).toBe(true);
  });

  it("covers every category and every status, including open and answered questions", () => {
    expect(new Set(reports.map((r) => r.category)).size).toBe(5);
    expect(new Set(reports.map((r) => r.status))).toEqual(
      new Set(["received", "under_review", "more_information_requested", "verified", "rejected", "referred_for_action", "closed"]),
    );
    expect(reports.some((r) => r.openQuestion() && !r.openQuestion()?.answeredAt)).toBe(true);
    expect(reports.some((r) => r.openQuestion()?.answeredAt)).toBe(true);
  });

  it("gives the demo officer plenty to work on", () => {
    const demo = reports.filter((r) => ["Tarkwa-Nsuaem Municipal", "District not known, Western Region"].includes(r.location.area));
    expect(demo.length).toBeGreaterThanOrEqual(20);
  });

  it("mixes anonymous reports with ones that left contact details, and some with GPS", () => {
    const withContact = reports.filter((r) => r.contact).length;
    expect(withContact).toBeGreaterThan(20);
    expect(withContact).toBeLessThan(SAMPLE_COUNT - 50);
    expect(reports.filter((r) => r.location.hasCoordinates).length).toBeGreaterThan(50);
  });

  it("never puts contact details, coordinates or landmarks into a public view (Requirement 4, all 200)", () => {
    const mapper = new PublicReportMapper();
    for (const report of reports) {
      const view = JSON.stringify(mapper.toView(report));
      if (report.contact?.phone) expect(view).not.toContain(report.contact.phone);
      if (report.contact?.email) expect(view).not.toContain(report.contact.email);
      if (report.contact?.name) expect(view).not.toContain(report.contact.name);
      if (report.location.latitude !== undefined) expect(view).not.toContain(String(report.location.latitude));
      if (report.location.placeDetails) expect(view).not.toContain(report.location.placeDetails);
      for (const reply of report.replies) expect(view).not.toContain(reply.answer);
    }
  });
});
