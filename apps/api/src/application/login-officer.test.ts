import { describe, it, expect } from "vitest";
import { LoginOfficer } from "./login-officer";
import { InvalidCredentialsError } from "./security-errors";
import { InMemoryUserStore } from "../infrastructure/in-memory-user-store";
import { JwtTokenService } from "../infrastructure/jwt-token-service";
import { ScryptPasswordHasher } from "../infrastructure/scrypt-password-hasher";

const PASSWORD = "correct-horse-battery-1";

async function setup(active = true) {
  const hasher = new ScryptPasswordHasher();
  const tokens = new JwtTokenService("test-secret-0123456789-0123456789-abcdef", 3600);
  const users = new InMemoryUserStore();
  users.add({
    id: "officer-1",
    email: "Officer@Example.com",
    passwordHash: await hasher.hash(PASSWORD),
    role: "officer",
    areas: ["Sample Community"],
    active,
  });
  return { login: new LoginOfficer(users, hasher, tokens), tokens };
}

// Runs an action that SHOULD fail and hands back the error it threw.
// If the action succeeds, the test fails, which is what we want.
async function errorOf(action: Promise<unknown>): Promise<Error> {
  try {
    await action;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("Expected the action to fail, but it succeeded");
}

describe("LoginOfficer", () => {
  it("gives a token that identifies the officer", async () => {
    const { login, tokens } = await setup();
    const { token } = await login.execute("officer@example.com", PASSWORD);
    expect(tokens.verify(token)).toBe("officer-1");
  });

  it("ignores capital letters in the email", async () => {
    const { login } = await setup();
    await expect(login.execute("OFFICER@EXAMPLE.COM", PASSWORD)).resolves.toHaveProperty("token");
  });

  it("refuses a wrong password", async () => {
    const { login } = await setup();
    await expect(login.execute("officer@example.com", "wrong-password")).rejects.toThrow(InvalidCredentialsError);
  });

  it("refuses an unknown email with the very same error", async () => {
    const { login } = await setup();
    const wrongPassword = await errorOf(login.execute("officer@example.com", "nope"));
    const unknownEmail = await errorOf(login.execute("nobody@example.com", PASSWORD));
    expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownEmail.message).toBe(wrongPassword.message);
  });

  it("refuses a disabled account even with the right password", async () => {
    const { login } = await setup(false);
    await expect(login.execute("officer@example.com", PASSWORD)).rejects.toThrow(InvalidCredentialsError);
  });

  it("refuses an empty password", async () => {
    const { login } = await setup();
    await expect(login.execute("officer@example.com", "")).rejects.toThrow(InvalidCredentialsError);
  });
});
