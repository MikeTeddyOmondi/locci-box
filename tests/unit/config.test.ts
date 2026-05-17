import { describe, it, expect } from "vitest";

describe("env", () => {
  it("ADMIN_API_KEY is set", () => {
    expect(process.env.ADMIN_API_KEY).toBeDefined();
    expect(process.env.ADMIN_API_KEY!.length).toBeGreaterThan(0);
  });
});
