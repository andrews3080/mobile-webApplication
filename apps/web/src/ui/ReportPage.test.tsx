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

type User = ReturnType<typeof userEvent.setup>;

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

// A complete draft already on the phone: the form opens straight at "Check and send"
async function setupAtCheck<O extends Partial<ReportServices>>(overrides: O = {} as O) {
  const drafts = new InMemoryDraftStore();
  await drafts.save(aDraft());
  const result = setup({ drafts, ...overrides });
  await screen.findByRole("heading", { name: "Check and send" });
  return result;
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const heading = (name: string) => screen.findByRole("heading", { name });
const next = (user: User) => user.click(button(/^(Next|Skip)$/));
const progressText = () => screen.getByRole("progressbar").getAttribute("aria-valuetext");

// The whole journey a reporter makes, one screen at a time
async function walkToCheck(user: User) {
  await user.click(await screen.findByLabelText(/Polluted river or stream/));
  await next(user);
  await user.type(await screen.findByRole("textbox", { name: "Describe what you saw" }), "Brown water and two excavators at the river");
  await next(user);
  await user.selectOptions(await screen.findByLabelText("Region"), "Western");
  await user.selectOptions(screen.getByLabelText("District"), "Tarkwa-Nsuaem Municipal");
  await next(user);
  await heading("Photos");
  await next(user); // Skip
  await heading("Your contact details");
  await next(user); // Skip
  await heading("Check and send");
}

describe("ReportPage, step by step", () => {
  it("walks through every step, sends the report and shows the tracking code", async () => {
    const { user, reports, drafts } = setup();
    await walkToCheck(user);
    await user.click(button("Send report"));

    expect(await screen.findByTestId("reference")).toHaveProperty("textContent", "ABCD-EFGH-JKMN");
    expect(reports.submitted).toHaveLength(1);
    expect(reports.submitted[0]?.body).toMatchObject({ category: "river_pollution", area: "Tarkwa-Nsuaem Municipal", photoKeys: [] });
    expect(await drafts.load()).toBeNull();
  }, 15_000);

  it("shows where the reporter is, as 'Step n of 6', and lets them go back without losing answers", async () => {
    const { user } = setup();
    await user.click(await screen.findByLabelText(/Machinery or equipment/));
    expect(progressText()).toBe("Step 1 of 6: What did you see?");

    await next(user);
    expect(await heading("Describe what you saw")).toBeDefined();
    expect(progressText()).toBe("Step 2 of 6: Describe what you saw");

    await user.click(button("Back"));
    expect(((await screen.findByLabelText(/Machinery or equipment/)) as HTMLInputElement).checked).toBe(true);
  });

  it("does not move on until the step is answered, and puts the cursor on the problem", async () => {
    const { user } = setup();
    await screen.findByLabelText(/Digging or excavation site/);
    await next(user);
    expect(screen.getByText("Please choose what you saw.")).toBeDefined();
    expect(progressText()).toContain("Step 1 of 6");
    expect(document.activeElement).toBe(screen.getByLabelText(/Digging or excavation site/));

    await user.click(screen.getByLabelText(/Digging or excavation site/));
    await next(user);
    await user.type(await screen.findByRole("textbox", { name: "Describe what you saw" }), "pits");
    await next(user);
    expect(screen.getByText(/at least 10 characters/)).toBeDefined();
    expect(progressText()).toContain("Step 2 of 6");
  });

  it("checks a field when the reporter leaves it, but not when they only pass through", async () => {
    const { user } = setup();
    await user.click(await screen.findByLabelText(/Digging or excavation site/));
    await next(user);
    const description = await screen.findByRole("textbox", { name: "Describe what you saw" });

    await user.click(description);
    await user.tab(); // left empty: no complaint yet
    expect(screen.queryByText(/at least 10 characters/)).toBeNull();

    await user.type(description, "diggers");
    await user.tab();
    expect(screen.getByText(/at least 10 characters/)).toBeDefined();
    expect(description.getAttribute("aria-invalid")).toBe("true");
  });

  it("offers 'Skip' on an empty optional step and 'Next' once something is in it", async () => {
    const { user } = await setupAtCheck();
    await user.click(button(/Change contact details/));
    expect(await heading("Your contact details")).toBeDefined();
    expect(button("Skip")).toBeDefined();
    await user.type(screen.getByLabelText("Phone"), "0240000000");
    expect(button("Next")).toBeDefined();
  });

  it("lists every answer on 'Check and send', with a way back to change each one", async () => {
    const { user } = await setupAtCheck();
    const summary = document.querySelector(".review")!;
    expect(summary.textContent).toContain("Polluted river or stream");
    expect(summary.textContent).toContain("Muddy water and diggers near the river bank");
    expect(summary.textContent).toContain("Tarkwa-Nsuaem Municipal");
    expect(summary.textContent).toContain("None: you stay anonymous");

    await user.click(button(/Change where and when/));
    expect(await heading("Where and when")).toBeDefined();
    expect((screen.getByLabelText("District") as HTMLSelectElement).value).toBe("Tarkwa-Nsuaem Municipal");
  });
});

describe("drafts on the phone", () => {
  it("saves each answer as soon as it is given", async () => {
    const { user, drafts } = setup();
    await user.click(await screen.findByLabelText(/Cleared forest or farmland/));
    await waitFor(async () => expect((await drafts.load())?.category).toBe("forest_clearing"));
    expect(await screen.findByText("Saved on this device")).toBeDefined();
  });

  it("opens a finished draft at 'Check and send'", async () => {
    await setupAtCheck();
    expect(progressText()).toBe("Step 6 of 6: Check and send");
    expect(screen.getByText(/We kept the report you started earlier/)).toBeDefined();
  });

  it("opens an unfinished draft at the first step that still needs an answer", async () => {
    const drafts = new InMemoryDraftStore();
    await drafts.save(aDraft({ description: "", placeDetails: "Prestea" }));
    setup({ drafts });
    expect(await heading("Describe what you saw")).toBeDefined();
  });

  it("asks before throwing a report away", async () => {
    const { user, drafts } = setup();
    await user.click(await screen.findByLabelText(/Polluted river or stream/));

    await user.click(button("Start a new report"));
    await user.click(button("No, keep my report"));
    expect((screen.getByLabelText(/Polluted river or stream/) as HTMLInputElement).checked).toBe(true);

    await user.click(button("Start a new report"));
    await user.click(button("Yes, delete it"));
    await waitFor(() => expect((screen.getByLabelText(/Polluted river or stream/) as HTMLInputElement).checked).toBe(false));
    expect(await drafts.load()).toBeNull();
  });
});

describe("sending", () => {
  it("keeps the report on the device when the connection keeps failing, and sends it later with the same key", async () => {
    const reports = new FakeReportApi();
    reports.failNext(networkError(), networkError(), networkError(), networkError());
    const { user, drafts } = await setupAtCheck({ reports });

    await user.click(button("Send report"));
    expect((await screen.findByRole("alert")).textContent).toContain("It is saved on this device");
    expect((await drafts.load())?.area).toBe("Tarkwa-Nsuaem Municipal");

    await user.click(button("Send report"));
    expect(await screen.findByTestId("reference")).toBeDefined();
    expect(new Set(reports.submitted.map((s) => s.key)).size).toBe(1);
  });

  it("shows the server's reason when it refuses the report", async () => {
    const reports = new FakeReportApi();
    reports.failNext(rejectedError());
    const { user } = await setupAtCheck({ reports });
    await user.click(button("Send report"));
    expect((await screen.findByRole("alert")).textContent).toBe("The report was not accepted: no");
  });

  it("starts a fresh, empty report at step 1 after sending", async () => {
    const { user } = await setupAtCheck();
    await user.click(button("Send report"));
    await user.click(await screen.findByRole("button", { name: "Make another report" }));
    expect(await heading("What did you see?")).toBeDefined();
    expect((screen.getByLabelText(/Polluted river or stream/) as HTMLInputElement).checked).toBe(false);
  });
});

describe("place, position and photos", () => {
  it("adds the phone's position on request and sends it", async () => {
    const { user, reports } = await setupAtCheck();
    await user.click(button(/Change where and when/));
    await user.click(await screen.findByRole("button", { name: "Use my current position" }));
    expect(await screen.findByText(/Position saved: 5\.30000, -1\.98000/)).toBeDefined();

    await next(user);
    await next(user);
    await next(user);
    await user.click(await screen.findByRole("button", { name: "Send report" }));
    await screen.findByTestId("reference");
    expect(reports.submitted[0]?.body).toMatchObject({ latitude: 5.3, longitude: -1.98 });
  });

  it("explains when the position is not available", async () => {
    const { user } = await setupAtCheck({ location: new FakeLocationFinder(null) });
    await user.click(button(/Change where and when/));
    await user.click(await screen.findByRole("button", { name: "Use my current position" }));
    expect(await screen.findByText(/We could not get your position/)).toBeDefined();
  });

  it("offers only the districts of the chosen region, plus 'I don't know the district'", async () => {
    const { user, reports } = await setupAtCheck();
    await user.click(button(/Change where and when/));
    await user.selectOptions(await screen.findByLabelText("Region"), "Western North");
    const district = screen.getByLabelText("District") as HTMLSelectElement;
    const options = Array.from(district.options).map((o) => o.textContent);
    expect(options).toContain("Sefwi Wiawso Municipal");
    expect(options).not.toContain("Tarkwa-Nsuaem Municipal");

    await user.selectOptions(district, "I don't know the district");
    await user.type(screen.getByLabelText(/Town, community or landmark/), "Near the cocoa farms after Akontombra");
    await next(user);
    await next(user);
    await next(user);
    await user.click(await screen.findByRole("button", { name: "Send report" }));
    await screen.findByTestId("reference");
    expect(reports.submitted[0]?.body).toMatchObject({
      area: "District not known, Western North Region",
      placeDetails: "Near the cocoa farms after Akontombra",
    });
  }, 15_000);

  it("uploads chosen photos with the report, and lets the reporter remove one", async () => {
    const { user, photos, reports } = await setupAtCheck();
    await user.click(button(/Change photos/));
    const files = [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.jpg", { type: "image/jpeg" })];
    await user.upload(await screen.findByLabelText(/Add photos/), files);
    await user.click(await screen.findByRole("button", { name: "Remove photo 2" }));
    expect(screen.queryByRole("button", { name: "Remove photo 2" })).toBeNull();

    await next(user);
    await next(user);
    expect(document.querySelector(".review")?.textContent).toContain("1 photo");
    await user.click(button("Send report"));
    await screen.findByTestId("reference");
    expect(photos.sent).toHaveLength(1);
    expect(reports.submitted[0]?.body.photoKeys).toHaveLength(1);
  });

  it("asks reporters not to photograph faces, especially children", async () => {
    const { user } = await setupAtCheck();
    await user.click(button(/Change photos/));
    expect(await screen.findByText(/Try not to show people's faces, especially children/)).toBeDefined();
  });
});

describe("privacy notice", () => {
  it("is on 'Check and send', before the send button", async () => {
    await setupAtCheck();
    const notice = screen.getByRole("region", { name: "Before you send" });
    expect(notice.textContent).toContain("only authorised officers for that area");
    expect(notice.textContent).toContain("Do not name or accuse anyone");
    expect(notice.textContent).toContain("Data Protection Act, 2012 (Act 843)");
    expect(notice.compareDocumentPosition(button("Send report")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
