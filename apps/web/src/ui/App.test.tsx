// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { InMemoryDraftStore } from "../infrastructure/in-memory-draft-store";
import {
  FakeCompressor,
  FakeLocationFinder,
  FakePhotoApi,
  FakeReportApi,
  FakeTrackApi,
  FixedClock,
  RecordingSleeper,
  SequenceIds,
} from "../test-support/fakes";

beforeEach(() => {
  window.location.hash = "";
});
afterEach(cleanup);

function renderApp() {
  const services = {
    drafts: new InMemoryDraftStore(),
    photos: new FakePhotoApi(),
    reports: new FakeReportApi(),
    compressor: new FakeCompressor(),
    location: new FakeLocationFinder(),
    clock: new FixedClock(),
    ids: new SequenceIds(),
    sleeper: new RecordingSleeper(),
    tracking: new FakeTrackApi(),
  };
  render(<App services={services} autosaveMs={0} />);
  return userEvent.setup();
}

describe("App", () => {
  it("opens on the report form, marked as the current page", async () => {
    renderApp();
    expect(await screen.findByRole("heading", { name: "Report illegal mining" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Report" }).getAttribute("aria-current")).toBe("page");
  });

  it("goes to the tracking page and back, keeping what was typed in the report", async () => {
    const user = renderApp();
    await user.click(await screen.findByLabelText(/Polluted river or stream/));

    await user.click(screen.getByRole("link", { name: "Check a report" }));
    expect(await screen.findByRole("heading", { name: "Check a report" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Check a report" }).getAttribute("aria-current")).toBe("page");

    await user.click(screen.getByRole("link", { name: "Report" }));
    expect(((await screen.findByLabelText(/Polluted river or stream/)) as HTMLInputElement).checked).toBe(true);
  });

  it("opens the tracking page straight from its address", async () => {
    window.location.hash = "#/track";
    renderApp();
    expect(await screen.findByRole("heading", { name: "Check a report" })).toBeDefined();
  });
});
