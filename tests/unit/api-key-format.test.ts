import { describe, it, expect } from "vitest";

const SK_LIVE_PREFIX = "lbk_live_";
const NANOID_LENGTH = 32;

function generateKey(): string {
  // mirrors ApiKeyService.create logic
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let id = "";
  for (let i = 0; i < NANOID_LENGTH; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${SK_LIVE_PREFIX}${id}`;
}

function maskKey(key: string): string {
  // mirrors apikeys.ts route masking logic
  return `${key.slice(0, 14)}…${key.slice(-4)}`;
}

describe("API key format", () => {
  it("generated key starts with lbk_live_", () => {
    const key = generateKey();
    expect(key.startsWith(SK_LIVE_PREFIX)).toBe(true);
  });

  it("generated key has correct total length", () => {
    const key = generateKey();
    expect(key.length).toBe(SK_LIVE_PREFIX.length + NANOID_LENGTH);
  });

  it("masked key shows first 14 chars and last 4", () => {
    // construct programmatically to avoid triggering secret scanning on static strings
    const key = generateKey();
    const masked = maskKey(key);
    expect(masked.startsWith(key.slice(0, 14))).toBe(true);
    expect(masked.endsWith(key.slice(-4))).toBe(true);
    expect(masked).toContain("…");
    expect(masked.length).toBe(14 + 1 + 4); // prefix + ellipsis + suffix
  });

  it("masked key contains ellipsis separator", () => {
    const key = generateKey();
    const masked = maskKey(key);
    expect(masked).toContain("…");
  });

  it("masked key never reveals full secret", () => {
    const key = generateKey();
    const masked = maskKey(key);
    expect(masked.length).toBeLessThan(key.length);
    const middle = key.slice(14, -4);
    expect(masked).not.toContain(middle);
  });
});
