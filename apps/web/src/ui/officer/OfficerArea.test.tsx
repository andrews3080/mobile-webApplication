// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OfficerArea } from "./OfficerArea";
import { ApiError } from "../../core/errors";
import { InMemoryTokenStore } from "../../infrastructure/token-stores";
import { anOfficerReport, FakeOfficerApi } from "../../test-support/fakes";

afterEach(cleanup);

function setup(api = new FakeOfficerApi(), tokens = new InMemoryTokenStore("token-1")) {
  const user = userEvent.setup();
  render(<OfficerArea api={api} tokens={tokens} />);
  return { user, api, tokens };
}

async function openReport(user: ReturnType<typeof userEvent.setup>, code = "ABCD-EFGH-JKMN") {
  await user.click(await screen.findByRole("button", { name: new RegExp(code) }));
  await screen.findByRole("heading", { level: 1, name: code });
}

describe("OfficerArea", () => {
  it("logs in, keeps the token for the session and shows the list", async () => {
    const { user, tokens } = setup(new FakeOfficerApi(), new InMemoryTokenStore());
    await user.type(screen.getByLabelText("Email"), "officer@example.com");
    await user.type(screen.getByLabelText("Password"), "right");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { name: "Reports in your areas" })).toBeDefined();
    expect(tokens.load()).toBe("token-1");
  });

  it("gives one plain message for a wrong email or password, and clears the password", async () => {
    const { user } = setup(new FakeOfficerApi(), new InMemoryTokenStore());
    await user.type(screen.getByLabelText("Email"), "officer@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Email or password is incorrect.");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });

  it("filters the list by status, with counts", async () => {
    const api = new FakeOfficerApi(
      anOfficerReport({ reference: "AAAA-AAAA-AAAA", status: "received" }),
      anOfficerReport({ reference: "BBBB-BBBB-BBBB", status: "received" }),
      anOfficerReport({ reference: "CCCC-CCCC-CCCC", status: "verified" }),
    );
    const { user } = setup(api);
    await screen.findByRole("button", { name: /AAAA-AAAA-AAAA/ });

    await user.click(screen.getByRole("button", { name: "Confirmed 1" }));
    const rows = within(screen.getByRole("list", { name: "1 reports" })).getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining("CCCC-CCCC-CCCC")]);
    expect(screen.getByRole("button", { name: "Confirmed 1" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the whole report, and says when the reporter stayed anonymous", async () => {
    const { user } = setup();
    await openReport(user);
    expect(screen.getByText("Brown water and two excavators at the river bank")).toBeDefined();
    expect(screen.getByText("The reporter chose to stay anonymous.")).toBeDefined();
    expect(screen.getByText("No photos were sent.")).toBeDefined();
  });

  it("starts a review with one press, then offers the decisions", async () => {
    const { user, api } = setup();
    await openReport(user);
    await user.click(screen.getByRole("button", { name: "Start review" }));

    expect(await screen.findByText("Review started.")).toBeDefined();
    expect(api.reviews).toEqual([{ code: "ABCD-EFGH-JKMN", action: "start-review", text: undefined }]);
    expect(screen.getByRole("button", { name: "Confirm report" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Do not confirm" })).toBeDefined();
  });

  it("needs a written reason before confirming, and records it", async () => {
    const { user, api } = setup(new FakeOfficerApi(anOfficerReport({ status: "under_review" })));
    await openReport(user);
    await user.click(screen.getByRole("button", { name: "Confirm report" }));

    const reason = screen.getByLabelText("Why is this confirmed?");
    await user.type(reason, "ok");
    await user.click(screen.getByRole("button", { name: "Confirm report" }));
    expect(screen.getByText(/at least 5 characters/)).toBeDefined();
    expect(api.reviews).toEqual([]);

    await user.type(reason, " - seen on site visit");
    await user.click(screen.getByRole("button", { name: "Confirm report" }));
    expect(await screen.findByText("Report confirmed.")).toBeDefined();
    expect(api.reviews[0]).toEqual({ code: "ABCD-EFGH-JKMN", action: "verify", text: "ok - seen on site visit" });
    expect(screen.getByText("“ok - seen on site visit”")).toBeDefined(); // now in the history
  });

  it("reloads the report when another officer changed it first", async () => {
    const api = new FakeOfficerApi(anOfficerReport({ status: "received" }));
    api.failNextReview = new ApiError("rejected", "This report was just updated by someone else.", 409);
    const { user } = setup(api);
    await openReport(user);
    await user.click(screen.getByRole("button", { name: "Start review" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Someone else updated this report");
  });

  it("sends the officer back to login when the session has expired", async () => {
    const { tokens } = setup(new FakeOfficerApi(), new InMemoryTokenStore("expired-token"));
    expect(await screen.findByText("Your session has ended. Please log in again.")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Officer login" })).toBeDefined();
    expect(tokens.load()).toBeNull();
  });

  it("logs out and forgets the token", async () => {
    const { user, tokens } = setup();
    await user.click(await screen.findByRole("button", { name: "Log out" }));
    expect(screen.getByText("You have logged out.")).toBeDefined();
    expect(tokens.load()).toBeNull();
  });
});
