import { describe, it, expect } from "vitest";
import { APP_NAME } from "@asaase-ani/shared";

// Only proves the toolchain works: TypeScript + Vitest + workspace link
describe("project setup", () => {
  it("can import from the shared package", () => {
    expect(APP_NAME).toBe("Asaase Ani");
  });
});
