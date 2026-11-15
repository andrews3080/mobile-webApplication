import { describe, it, expect } from "vitest";
import { ReferenceCode } from "./reference-code";
import { DomainError } from "./errors";

describe("ReferenceCode", () => {
  it("formats as XXXX-XXXX-XXXX", () => {
    expect(ReferenceCode.parse("ABCDEFGHJKMN").toString()).toBe("ABCD-EFGH-JKMN");
  });

  it("accepts lowercase letters, spaces and dashes", () => {
    const a = ReferenceCode.parse("abcd efgh-jkmn");
    expect(a.equals(ReferenceCode.parse("ABCD-EFGH-JKMN"))).toBe(true);
  });

  it("fixes common typing mistakes (O to 0)", () => {
    const typed = ReferenceCode.parse("ABCD-EFGH-JKMO");
    expect(typed.toString()).toBe("ABCD-EFGH-JKM0");
  });

  it("rejects the wrong length", () => {
    expect(() => ReferenceCode.parse("ABCD")).toThrow(DomainError);
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => ReferenceCode.parse("UUUU-UUUU-UUUU")).toThrow(DomainError);
  });
});
