// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackPage } from "./TrackPage";
import { ApiError } from "../core/errors";
import { aPublicReport, FakeTrackApi, networkError } from "../test-support/fakes";

afterEach(cleanup);

function setup(tracking = new FakeTrackApi()) {
  const user = userEvent.setup();
  render(<TrackPage tracking={tracking} />);
  const codeInput = screen.getByLabelText("Tracking code") as HTMLInputElement;
  const check = () => user.click(screen.getByRole("button", { name: "Check status" }));
  return { user, tracking, codeInput, check };
}

describe("TrackPage", () => {
  it("shows the status in plain words, the details and the history, newest first", async () => {
    const { user, codeInput, check } = setup();
    await user.type(codeInput, "ABCD-EFGH-JKMN");
    await check();

    expect(await screen.findByRole("heading", { name: "Report ABCD-EFGH-JKMN" })).toBeDefined();
    expect(screen.getByText("An officer is checking your report now.")).toBeDefined();
    expect(screen.getByText("Polluted river or stream")).toBeDefined();
    expect(screen.getByText("Sample Community")).toBeDefined();
    const steps = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(steps[0]).toContain("Being checked");
    expect(steps[1]).toContain("Received");
  });

  it("tidies a code typed with spaces and lower case before asking", async () => {
    const { user, codeInput, check, tracking } = setup();
    await user.type(codeInput, "abcd efgh jkmn");
    await check();
    await screen.findByRole("heading", { name: "Report ABCD-EFGH-JKMN" });
    expect(tracking.asked).toEqual(["ABCD-EFGH-JKMN"]);
    expect(codeInput.value).toBe("ABCD-EFGH-JKMN");
  });

  it("points out a code that is too short without asking the server", async () => {
    const { user, codeInput, check, tracking } = setup();
    await user.type(codeInput, "ABCD-EFGH");
    await check();
    expect(screen.getByText(/Yours has 8/)).toBeDefined();
    expect(codeInput.getAttribute("aria-invalid")).toBe("true");
    expect(tracking.asked).toEqual([]);
  });

  it("says plainly when no report has that code", async () => {
    const { user, codeInput, check } = setup();
    await user.type(codeInput, "ZZZZ-ZZZZ-ZZZZ");
    await check();
    expect((await screen.findByRole("alert")).textContent).toContain("We could not find a report with this code");
  });

  it("tells the reporter when the connection is the problem", async () => {
    const tracking = new FakeTrackApi();
    tracking.failure = networkError();
    const { user, codeInput, check } = setup(tracking);
    await user.type(codeInput, "ABCD-EFGH-JKMN");
    await check();
    expect((await screen.findByRole("alert")).textContent).toContain("Check your connection");
  });

  it("asks people to slow down when they try too often", async () => {
    const tracking = new FakeTrackApi();
    tracking.failure = new ApiError("rate_limited", "slow down", 429, 60);
    const { user, codeInput, check } = setup(tracking);
    await user.type(codeInput, "ABCD-EFGH-JKMN");
    await check();
    expect((await screen.findByRole("alert")).textContent).toContain("Too many tries");
  });

  it("still shows a report whose status this version does not know", async () => {
    const tracking = new FakeTrackApi(aPublicReport({ status: "on_hold", timeline: [{ status: "on_hold", at: "2026-11-15T09:30:00.000Z" }] }));
    const { user, codeInput, check } = setup(tracking);
    await user.type(codeInput, "ABCD-EFGH-JKMN");
    await check();
    expect((await screen.findAllByText("on hold")).length).toBeGreaterThan(0);
  });
});

describe("answering an officer's question", () => {
  const asked = () =>
    new FakeTrackApi(
      aPublicReport({
        status: "more_information_requested",
        question: { text: "Which side of the river is the site?", askedAt: "2026-11-15T10:00:00.000Z", answeredAt: null },
      }),
    );

  it("shows the question and sends the answer, then thanks the reporter", async () => {
    const tracking = asked();
    const { user, codeInput, check } = setup(tracking);
    await user.type(codeInput, "ABCD-EFGH-JKMN");
    await check();

    expect(await screen.findByText("Which side of the river is the site?")).toBeDefined();
    expect(screen.getByText("An officer has a question about your report. Please answer it below.")).toBeDefined();

    await user.type(screen.getByLabelText("Your answer"), "  The east bank, past the bridge  ");
    await user.click(screen.getByRole("button", { name: "Send answer" }));

    expect((await screen.findByRole("status")).textContent).toContain("Thank you. Your answer was sent");
    expect(tracking.answers).toEqual([{ code: "ABCD-EFGH-JKMN", answer: "The east bank, past the bridge" }]);
    expect(screen.queryByLabelText("Your answer")).toBeNull();
    expect(screen.getByText("You answered the officer's question. An officer will continue checking your report.")).toBeDefined();
    expect(screen.queryByText(/Please answer it below/)).toBeNull();
  });

  it("asks for an answer before sending", async () => {
    const tracking = asked();
    const { user, codeInput, check } = setup(tracking);
    await user.type(codeInput, "ABCD-EFGH-JKMN");
    await check();
    await user.click(await screen.findByRole("button", { name: "Send answer" }));
    expect(screen.getByText("Please write your answer.")).toBeDefined();
    expect(tracking.answers).toEqual([]);
  });

  it("keeps the typed answer when the connection fails", async () => {
    const tracking = asked();
    const { user, codeInput, check } = setup(tracking);
    await user.type(codeInput, "ABCD-EFGH-JKMN");
    await check();
    await user.type(await screen.findByLabelText("Your answer"), "The east bank");
    tracking.failure = networkError();
    await user.click(screen.getByRole("button", { name: "Send answer" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Your answer is still here");
    expect((screen.getByLabelText("Your answer") as HTMLTextAreaElement).value).toBe("The east bank");
  });

  it("shows no question box when nothing was asked", async () => {
    const { user, codeInput, check } = setup();
    await user.type(codeInput, "ABCD-EFGH-JKMN");
    await check();
    await screen.findByRole("heading", { name: "Report ABCD-EFGH-JKMN" });
    expect(screen.queryByText("An officer asked you")).toBeNull();
  });
});
