import { describe, it, expect } from "vitest";
import { TrackReport } from "./track-report";
import { PublicReportMapper } from "./public-report-mapper";
import { NotFoundError } from "./errors";
import { InMemoryReportRepository } from "../infrastructure/in-memory-report-repository";
import { aReport, LATER } from "../test-support/builders";

const KEY = "11111111-2222-3333-4444-555555555555";

async function setup() {
  const repo = new InMemoryReportRepository();
  await repo.saveIfNew(aReport("ABCD-EFGH-JKMN"), KEY);
  return new TrackReport(repo, new PublicReportMapper());
}

describe("TrackReport", () => {
  it("shows the public status for a valid code", async () => {
    const tracker = await setup();
    const view = await tracker.execute("ABCD-EFGH-JKMN");
    expect(view.status).toBe("received");
    expect(view.area).toBe("Sample Community");
  });

  it("accepts lowercase letters and a missing dash", async () => {
    const tracker = await setup();
    const view = await tracker.execute("abcd efgh jkmn");
    expect(view.reference).toBe("ABCD-EFGH-JKMN");
  });

  it("says not found for an unknown code", async () => {
    const tracker = await setup();
    await expect(tracker.execute("CCCC-CCCC-CCCC")).rejects.toThrow(NotFoundError);
  });

  it("says not found for a malformed code, exactly like an unknown one", async () => {
    const tracker = await setup();
    await expect(tracker.execute("hello")).rejects.toThrow(NotFoundError);
  });

  it("shows progress after an officer reviews the report", async () => {
    const repo = new InMemoryReportRepository();
    const reviewed = aReport("ABCD-EFGH-JKMN").transitionTo("under_review", "officer-1", LATER);
    await repo.saveIfNew(reviewed, KEY);
    const view = await new TrackReport(repo, new PublicReportMapper()).execute("ABCD-EFGH-JKMN");
    expect(view.status).toBe("under_review");
    expect(view.timeline.map((t) => t.status)).toEqual(["received", "under_review"]);
  });
});
