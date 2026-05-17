import { describe, it, expect } from "vitest";

interface Run {
  createdAt: string;
}

function getDailyRuns(rows: Run[], days = 7): { day: string; runs: number }[] {
  // inline copy of TenantService.getDailyRuns bucketing logic
  const now = new Date();
  const result: { day: string; runs: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
    const count = rows.filter((r) => r.createdAt.startsWith(dateStr)).length;
    result.push({ day: dayLabel, runs: count });
  }

  return result;
}

describe("getDailyRuns bucketing", () => {
  it("returns exactly 7 entries by default", () => {
    expect(getDailyRuns([])).toHaveLength(7);
  });

  it("returns N entries when days=N", () => {
    expect(getDailyRuns([], 3)).toHaveLength(3);
    expect(getDailyRuns([], 14)).toHaveLength(14);
  });

  it("all runs are zero when no rows", () => {
    const result = getDailyRuns([]);
    expect(result.every((r) => r.runs === 0)).toBe(true);
  });

  it("counts today's runs in the last bucket", () => {
    const today = new Date().toISOString();
    const rows = [{ createdAt: today }, { createdAt: today }];
    const result = getDailyRuns(rows);
    expect(result[result.length - 1].runs).toBe(2);
  });

  it("counts yesterday's runs in second-to-last bucket", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const rows = [{ createdAt: yesterday.toISOString() }];
    const result = getDailyRuns(rows);
    expect(result[result.length - 2].runs).toBe(1);
    expect(result[result.length - 1].runs).toBe(0);
  });

  it("each entry has day label and runs count", () => {
    const result = getDailyRuns([]);
    for (const entry of result) {
      expect(entry).toHaveProperty("day");
      expect(entry).toHaveProperty("runs");
      expect(typeof entry.day).toBe("string");
      expect(typeof entry.runs).toBe("number");
    }
  });

  it("day labels are short weekday strings", () => {
    const validDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const result = getDailyRuns([]);
    for (const entry of result) {
      expect(validDays).toContain(entry.day);
    }
  });

  it("does not count runs outside the window", () => {
    const old = new Date();
    old.setDate(old.getDate() - 8);
    const rows = [{ createdAt: old.toISOString() }];
    const result = getDailyRuns(rows);
    expect(result.every((r) => r.runs === 0)).toBe(true);
  });
});
