import { describe, it, expect } from "vitest";
import { ApiError } from "./errors";
import { withRetry } from "./retry";
import { networkError, rejectedError, RecordingSleeper, serverError } from "../test-support/fakes";

// An action that fails with the given errors one by one, then succeeds
function flaky(...errors: Error[]) {
  const queue = [...errors];
  const state = { calls: 0 };
  const action = async () => {
    state.calls += 1;
    const error = queue.shift();
    if (error) throw error;
    return "done";
  };
  return { action, state };
}

const options = (sleeper: RecordingSleeper, attempts = 4) => ({ attempts, baseDelayMs: 1000, sleeper });

describe("withRetry", () => {
  it("returns at once when the first try works, without waiting", async () => {
    const sleeper = new RecordingSleeper();
    const { action, state } = flaky();
    expect(await withRetry(action, options(sleeper))).toBe("done");
    expect(state.calls).toBe(1);
    expect(sleeper.waits).toEqual([]);
  });

  it("retries network and server problems, waiting longer each time", async () => {
    const sleeper = new RecordingSleeper();
    const { action, state } = flaky(networkError(), serverError(), networkError());
    expect(await withRetry(action, options(sleeper))).toBe("done");
    expect(state.calls).toBe(4);
    expect(sleeper.waits).toEqual([1000, 2000, 4000]);
  });

  it("does not retry when the server says no (4xx)", async () => {
    const sleeper = new RecordingSleeper();
    const { action, state } = flaky(rejectedError());
    await expect(withRetry(action, options(sleeper))).rejects.toThrow(ApiError);
    expect(state.calls).toBe(1);
    expect(sleeper.waits).toEqual([]);
  });

  it("does not retry errors that are not API errors", async () => {
    const sleeper = new RecordingSleeper();
    const { action, state } = flaky(new TypeError("bug"));
    await expect(withRetry(action, options(sleeper))).rejects.toThrow(TypeError);
    expect(state.calls).toBe(1);
  });

  it("gives up after the last attempt and throws the last error", async () => {
    const sleeper = new RecordingSleeper();
    const { action, state } = flaky(networkError(), networkError(), serverError());
    await expect(withRetry(action, options(sleeper, 3))).rejects.toMatchObject({ kind: "server" });
    expect(state.calls).toBe(3);
    expect(sleeper.waits).toEqual([1000, 2000]); // no wait after the final failure
  });

  it("listens when the server says how long to wait (429)", async () => {
    const sleeper = new RecordingSleeper();
    const { action } = flaky(new ApiError("rate_limited", "slow down", 429, 7));
    await withRetry(action, options(sleeper));
    expect(sleeper.waits).toEqual([7000]);
  });

  it("never waits more than 30 seconds", async () => {
    const sleeper = new RecordingSleeper();
    const { action } = flaky(new ApiError("rate_limited", "slow down", 429, 600));
    await withRetry(action, options(sleeper));
    expect(sleeper.waits).toEqual([30_000]);
  });
});
