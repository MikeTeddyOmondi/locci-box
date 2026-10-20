import { describe, it, expect } from "vitest";
import { boxNetworkPolicy, guestPath } from "../../src/services/BoxService.js";

describe("box network policy", () => {
  // Built by the real microsandbox builder, so a rule it cannot parse fails here.
  const policy = boxNetworkPolicy().build() as any;
  const rules: any[] = policy.rules;

  it("denies egress unless a rule allows it", () => {
    expect(policy.defaultEgress).toBe("deny");
  });

  it("allows DNS to microsandbox's resolver before any deny", () => {
    const first = rules[0];
    expect(first.action).toBe("allow");
    expect(first.destination).toMatchObject({ kind: "group" });
    expect(JSON.stringify(first.ports)).toContain("53");
  });

  it("denies the host's networks before allowing the public internet", () => {
    const allowPublic = rules.findIndex(
      (r) => r.action === "allow" && r.destination?.kind === "group" && r.destination.group === "public",
    );
    expect(allowPublic).toBeGreaterThan(0);
    const denied = rules
      .slice(0, allowPublic)
      .filter((r) => r.action === "deny")
      .map((r) => r.destination.group ?? r.destination.cidr);
    for (const d of ["private", "loopback", "metadata", "host", "100.64.0.0/10", "169.254.0.0/16", "fc00::/7", "fe80::/10"]) {
      expect(denied).toContain(d);
    }
  });
});

describe("guestPath", () => {
  it("puts relative paths under /workspace", () => {
    expect(guestPath("src/app.py")).toBe("/workspace/src/app.py");
    expect(guestPath("./a/../b.txt")).toBe("/workspace/b.txt");
  });

  it("keeps absolute paths (the box is the boundary)", () => {
    expect(guestPath("/etc/hosts")).toBe("/etc/hosts");
  });

  it("rejects an empty path", () => {
    expect(() => guestPath("")).toThrow(/path is required/);
  });
});
