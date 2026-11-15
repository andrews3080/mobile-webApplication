import { describe, it, expect } from "vitest";
import type { Actor } from "../domain/actor";
import { ReferenceCode } from "../domain/reference-code";
import { ForbiddenError, NotFoundError } from "./errors";
import { anAdmin, anOfficer } from "../test-support/actors";
import { CODE, setupReview } from "../test-support/review-setup";
import type { ReviewSetup } from "../test-support/review-setup";

// Milestone 1, Requirement 4: access-control tests must be refused AND logged.
// Every officer action is tried by every kind of refused person.

type Call = (s: ReviewSetup, actor: Actor, code: string) => Promise<unknown>;

const reportCalls: { what: string; call: Call }[] = [
  { what: "view the report", call: (s, a, c) => s.get.execute(a, c) },
  { what: "start a review", call: (s, a, c) => s.start.execute(a, c) },
  { what: "verify", call: (s, a, c) => s.verify.execute(a, c, "Photos match the site") },
  { what: "reject", call: (s, a, c) => s.reject.execute(a, c, "Photos show a farm, not a mine") },
  { what: "request information", call: (s, a, c) => s.askInfo.execute(a, c, "Which side of the river?") },
];

const refusedActors: { who: string; actor: Actor }[] = [
  { who: "an administrator", actor: anAdmin() },
  { who: "a disabled officer", actor: anOfficer({ active: false }) },
  { who: "an officer from another area", actor: anOfficer({ areas: ["Other District"] }) },
];

// 3 kinds of refused person x 5 actions = 15 cases
const refusedCases = refusedActors.flatMap(({ who, actor }) =>
  reportCalls.map(({ what, call }) => ({ who, what, actor, call })),
);

describe("access control on an existing report", () => {
  it.each(refusedCases)("refuses $who trying to $what, and logs it", async ({ actor, call }) => {
    const s = await setupReview();

    await expect(call(s, actor, CODE)).rejects.toThrow(ForbiddenError);

    const entries = s.audit.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe("denied");
    expect(entries[0]?.actorId).toBe(actor.id);

    // and nothing changed
    const stored = await s.repo.findByReference(ReferenceCode.parse(CODE));
    expect(stored?.status).toBe("received");
  });
});

// 2 persons who cannot work with reports at all x 5 actions = 10 cases
const noAccessActors = refusedActors.filter(({ who }) => who !== "an officer from another area");
const unknownCodeCases = noAccessActors.flatMap(({ who, actor }) =>
  reportCalls.map(({ what, call }) => ({ who, what, actor, call })),
);

describe("access control with an unknown code", () => {
  it.each(unknownCodeCases)(
    "still says 'not allowed' (not 'not found') when $who tries to $what",
    async ({ actor, call }) => {
      const s = await setupReview();
      await expect(call(s, actor, "CCCC-CCCC-CCCC")).rejects.toThrow(ForbiddenError);
      expect(s.audit.entries()[0]?.outcome).toBe("denied");
    },
  );

  // 5 cases
  it.each(reportCalls)("tells a valid officer 'not found' when they try to $what", async ({ call }) => {
    const s = await setupReview();
    await expect(call(s, anOfficer(), "CCCC-CCCC-CCCC")).rejects.toThrow(NotFoundError);
    expect(s.audit.entries()[0]?.detail).toBe("report not found");
  });
});

describe("access control on the report list", () => {
  it("refuses an administrator and logs it", async () => {
    const s = await setupReview();
    await expect(s.list.execute(anAdmin())).rejects.toThrow(ForbiddenError);
    expect(s.audit.entries()[0]?.outcome).toBe("denied");
  });

  it("refuses a disabled officer and logs it", async () => {
    const s = await setupReview();
    await expect(s.list.execute(anOfficer({ active: false }))).rejects.toThrow(ForbiddenError);
    expect(s.audit.entries()[0]?.outcome).toBe("denied");
  });
});
