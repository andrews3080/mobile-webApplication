// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportPage } from "./ReportPage";
import type { ReportServices } from "./services";
import { InMemoryDraftStore } from "../infrastructure/in-memory-draft-store";
import {
  aDraft,
  FakeCompressor,
  FakeLocationFinder,
  FakePhotoApi,
  FakeReportApi,
  FixedClock,
  networkError,
  RecordingSleeper,
  rejectedError,
  SequenceIds,
} from "../test-support/fakes";

afterEach(cleanup);

// Generic so each fake keeps its own type (tests read fake-only fields such as reports.submitted)
function setup<O extends Partial<ReportServices>>(overrides: O = {} as O) {
  const services = {
    drafts: new InMemoryDraftStore(),
    photos: new FakePhotoApi(),
    reports: new FakeReportApi(),
    compressor: new FakeCompressor(),
    location: new FakeLocationFinder(),
    clock: new FixedClock(),
    ids: new SequenceIds(),
    sleeper: new RecordingSleeper(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<ReportPage services={services} autosaveMs={0} />);
  return { ...services, user };
}

const sendButton = () => screen.getByRole("button", { name: "Send report" });

async function fillValidReport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByLabelText("Polluted river or stream"));
  await user.type(screen.getByLabelText("Describe what you saw"), "Brown water and two excavators at the river");
  await user.selectOptions(screen.getByLabelText("Region"), "Western");
  await user.selectOptions(screen.getByLabelText("District"), "Tarkwa-Nsuaem Municipal");
}

describe("ReportPage", () => {
  it("sends a complete report and shows the tracking code", async () => {
    const { user, reports, drafts } = setup();
    await fillValidReport(user);
    await user.click(sendButton());

    expect(await screen.findByTestId("reference")).toHaveProperty("textContent", "ABCD-EFGH-JKMN");
    expect(reports.submitted).toHaveLength(1);
    expect(reports.submitted[0]?.body).toMatchObject({ category: "river_pollution", area: "Tarkwa-Nsuaem Municipal", photoKeys: [] });
    expect(await drafts.load()).toBeNull();
  });

  it("lists every problem and sends nothing when the form is incomplete", async () => {
    const { user, reports } = setup();
    await user.click(await screen.findByRole("button", { name: "Send report" }));

    const summary = screen.getByRole("alert");
    expect(summary.textContent).toContain("Please choose what you saw.");
    expect(summary.textContent).toContain("Please describe what you saw");
    expect(summary.textContent).toContain("Please choose the region.");
    expect(screen.getByLabelText("Region").getAttribute("aria-invalid")).toBe("true");
    expect(reports.submitted).toHaveLength(0);
  });

  it("checks a field when the reporter leaves it, but not when they only pass through", async () => {
    const { user } = setup();
    const description = await screen.findByLabelText("Describe what you saw");

    await user.click(description);
    await user.tab(); // left empty: no complaint yet
    expect(screen.queryByText(/at least 10 characters/)).toBeNull();

    await user.type(description, "diggers");
    await user.tab();
    expect(screen.getByText(/at least 10 characters/)).toBeDefined();
    expect(description.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText("Please check these before sending")).toBeNull(); // the summary waits for "Send"
  });

  it("moves the cursor into the field when a problem in the summary is chosen", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Send report" }));
    await user.click(screen.getByRole("link", { name: "Please choose the region." }));
    expect(document.activeElement).toBe(screen.getByLabelText("Region"));
  });

  it("asks before throwing a report away", async () => {
    const { user, drafts } = setup();
    await user.type(await screen.findByLabelText(/Town, community or landmark/), "Tarkwa");

    await user.click(screen.getByRole("button", { name: "Start a new report" }));
    await user.click(screen.getByRole("button", { name: "No, keep my report" }));
    expect(screen.getByDisplayValue("Tarkwa")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Start a new report" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    await waitFor(() => expect((screen.getByLabelText(/Town, community or landmark/) as HTMLInputElement).value).toBe(""));
    expect(await drafts.load()).toBeNull();
  });

  it("saves what the reporter types on the device", async () => {
    const { user, drafts } = setup();
    await user.type(await screen.findByLabelText(/Town, community or landmark/), "Tarkwa");
    await waitFor(async () => expect((await drafts.load())?.placeDetails).toBe("Tarkwa"));
    expect(await screen.findByText("Saved on this device")).toBeDefined();
  });

  it("picks up a report started earlier", async () => {
    const drafts = new InMemoryDraftStore();
    await drafts.save(aDraft({ area: "Prestea" }));
    setup({ drafts });
    expect(await screen.findByDisplayValue("Prestea")).toBeDefined();
    expect(screen.getByText(/We kept the report you started earlier/)).toBeDefined();
  });

  it("keeps the report on the device when the connection keeps failing", async () => {
    const reports = new FakeReportApi();
    reports.failNext(networkError(), networkError(), networkError(), networkError());
    const { user, drafts } = setup({ reports });
    await fillValidReport(user);
    await user.click(sendButton());

    expect((await screen.findByRole("alert")).textContent).toContain("It is saved on this device");
    expect((await drafts.load())?.area).toBe("Tarkwa-Nsuaem Municipal");

    // Later the connection is back: pressing send again works, with the same idempotency key
    await user.click(sendButton());
    expect(await screen.findByTestId("reference")).toBeDefined();
    expect(new Set(reports.submitted.map((s) => s.key)).size).toBe(1);
  });

  it("shows the server's reason when it refuses the report", async () => {
    const reports = new FakeReportApi();
    reports.failNext(rejectedError());
    const { user } = setup({ reports });
    await fillValidReport(user);
    await user.click(sendButton());
    expect((await screen.findByRole("alert")).textContent).toBe("The report was not accepted: no");
  });

  it("adds the phone's position on request and can remove it", async () => {
    const { user, reports } = setup();
    await user.click(await screen.findByRole("button", { name: "Use my current position" }));
    expect(await screen.findByText(/Position saved: 5\.30000, -1\.98000/)).toBeDefined();

    await fillValidReport(user);
    await user.click(sendButton());
    await screen.findByTestId("reference");
    expect(reports.submitted[0]?.body).toMatchObject({ latitude: 5.3, longitude: -1.98 });
  });

  it("explains when the position is not available", async () => {
    const { user } = setup({ location: new FakeLocationFinder(null) });
    await user.click(await screen.findByRole("button", { name: "Use my current position" }));
    expect(await screen.findByText(/We could not get your position/)).toBeDefined();
  });

  it("uploads chosen photos with the report, and lets the reporter remove one", async () => {
    const { user, photos, reports } = setup();
    const files = [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.jpg", { type: "image/jpeg" })];
    await user.upload(await screen.findByLabelText(/Add photos/), files);
    expect(await screen.findByRole("button", { name: "Remove photo 2" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Remove photo 2" }));
    expect(screen.queryByRole("button", { name: "Remove photo 2" })).toBeNull();

    await fillValidReport(user);
    await user.click(sendButton());
    await screen.findByTestId("reference");
    expect(photos.sent).toHaveLength(1);
    expect(reports.submitted[0]?.body.photoKeys).toHaveLength(1);
  });

  it("starts a fresh, empty report after sending", async () => {
    const { user } = setup();
    await fillValidReport(user);
    await user.click(sendButton());
    await user.click(await screen.findByRole("button", { name: "Make another report" }));
    expect(((await screen.findByLabelText(/Town, community or landmark/)) as HTMLInputElement).value).toBe("");
  });
});

describe("privacy notice", () => {
  it("says who sees the report and asks not to name anyone, before the send button", async () => {
    setup();
    const notice = await screen.findByRole("region", { name: "Before you send" });
    expect(notice.textContent).toContain("only authorised officers for that area");
    expect(notice.textContent).toContain("Do not name or accuse anyone");
    expect(notice.textContent).toContain("Data Protection Act, 2012 (Act 843)");
    // the notice comes before the send button in reading order
    const send = screen.getByRole("button", { name: "Send report" });
    expect(notice.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("asks reporters not to photograph faces, especially children", async () => {
    setup();
    expect(await screen.findByText(/Try not to show people's faces, especially children/)).toBeDefined();
  });
});

describe("choosing the place", () => {
  it("offers only the districts of the chosen region, plus 'I don't know the district'", async () => {
    const { user, reports } = setup();
    const district = (await screen.findByLabelText("District")) as HTMLSelectElement;
    expect(district.disabled).toBe(true); // region first

    await user.selectOptions(screen.getByLabelText("Region"), "Western North");
    const options = Array.from(district.options).map((o) => o.textContent);
    expect(options).toContain("Sefwi Wiawso Municipal");
    expect(options).not.toContain("Tarkwa-Nsuaem Municipal");

    await user.click(screen.getByLabelText("Cleared forest or farmland"));
    await user.type(screen.getByLabelText("Describe what you saw"), "Trees cut down and pits dug near the stream");
    await user.selectOptions(district, "I don't know the district");
    await user.type(screen.getByLabelText(/Town, community or landmark/), "Near the cocoa farms after Akontombra");
    await user.click(screen.getByRole("button", { name: "Send report" }));

    await screen.findByTestId("reference");
    expect(reports.submitted[0]?.body).toMatchObject({
      area: "District not known, Western North Region",
      placeDetails: "Near the cocoa farms after Akontombra",
    });
  }, 15_000); // fills in a whole report key by key, which is slow in jsdom when the full suite runs in parallel
});

describe("picture tiles for what was seen", () => {
  it("offers one labelled picture per category, as a radio group", async () => {
    setup();
    const group = await screen.findByRole("group", { name: "What did you see?" });
    const radios = Array.from(group.querySelectorAll('input[type="radio"]')).map((r) => (r as HTMLInputElement).value);
    expect(radios).toEqual(["excavation_site", "river_pollution", "forest_clearing", "machinery_or_equipment", "other"]);
  });

  it("marks the chosen picture and keeps it in the draft", async () => {
    const { user, drafts } = setup();
    const tile = (await screen.findByLabelText("Machinery or equipment")) as HTMLInputElement;
    await user.click(tile);
    expect(tile.checked).toBe(true);
    await waitFor(async () => expect((await drafts.load())?.category).toBe("machinery_or_equipment"));
  });

  it("sends the officer to the first tile from the error summary", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Send report" }));
    await user.click(screen.getByRole("link", { name: "Please choose what you saw." }));
    expect(document.activeElement).toBe(screen.getByLabelText("Digging or excavation site"));
  });
});
