import { describe, it, expect } from "vitest";
import { JwtTokenService } from "./jwt-token-service";

const SECRET = "test-secret-0123456789-0123456789-abcdef";

describe("JwtTokenService", () => {
  const service = new JwtTokenService(SECRET, 3600);

  it("gives back the user id from a valid token", () => {
    expect(service.verify(service.issue("officer-1"))).toBe("officer-1");
  });

  it("refuses garbage", () => {
    expect(service.verify("not.a.token")).toBeNull();
    expect(service.verify("")).toBeNull();
  });

  it("refuses a token signed with a different secret", () => {
    const other = new JwtTokenService("another-secret-0123456789-0123456789-xyz", 3600);
    expect(service.verify(other.issue("officer-1"))).toBeNull();
  });

  it("refuses a token whose user id was swapped (signature no longer matches)", () => {
    const [header, , signature] = service.issue("officer-1").split(".");
    const [, forgedPayload] = service.issue("admin-1").split(".");
    expect(service.verify(`${header}.${forgedPayload}.${signature}`)).toBeNull();
  });

  it("refuses to start with a short secret", () => {
    expect(() => new JwtTokenService("short", 3600)).toThrow();
  });
});
