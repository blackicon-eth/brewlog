import {
  clampTimePart, composeBrewedAt, dayLabel, dayOptions,
  formatBrewedAtValue, pad2, startOfDayTs,
} from "../brewedAt";

// Sunday 12 Jul 2026, 15:30 local — matches the ledger's local-time day logic.
const NOW = new Date(2026, 6, 12, 15, 30).getTime();
const DAY_MS = 86_400_000;
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo, d, h, mi).getTime();

describe("startOfDayTs", () => {
  it("returns local midnight of the same day", () => {
    expect(startOfDayTs(NOW)).toBe(at(2026, 6, 12));
    expect(startOfDayTs(at(2026, 6, 12, 23, 59))).toBe(at(2026, 6, 12));
  });
});

describe("dayOptions", () => {
  it("lists today plus six days back with ledger labels", () => {
    const opts = dayOptions(NOW);
    expect(opts.map((o) => o.label)).toEqual([
      "Today", "Yesterday", "Fri 10", "Thu 9", "Wed 8", "Tue 7", "Mon 6",
    ]);
    expect(opts[0].dayStart).toBe(at(2026, 6, 12));
    for (let i = 1; i < opts.length; i++) {
      expect(opts[i - 1].dayStart - opts[i].dayStart).toBe(DAY_MS);
    }
  });

  it("keys are the dayStart as a string", () => {
    const opts = dayOptions(NOW);
    expect(opts[0].key).toBe(String(opts[0].dayStart));
  });

  it("does not duplicate an existing brew inside the window", () => {
    const opts = dayOptions(NOW, at(2026, 6, 9, 7, 40)); // Thu 9 — already a chip
    expect(opts).toHaveLength(7);
  });

  it("prepends an existing brew's day when it is outside the window", () => {
    const existing = at(2026, 5, 12, 7, 40); // 12 Jun 2026
    const opts = dayOptions(NOW, existing);
    expect(opts).toHaveLength(8);
    expect(opts[0].label).toBe("12 Jun");
    expect(opts[0].dayStart).toBe(at(2026, 5, 12));
  });

  it("appends the year for an existing brew from another year", () => {
    const opts = dayOptions(NOW, at(2025, 5, 12, 7, 40));
    expect(opts[0].label).toBe("12 Jun 2025");
  });
});

describe("dayLabel", () => {
  it("uses weekday+day inside the week, absolute date beyond it", () => {
    expect(dayLabel(at(2026, 6, 6), NOW)).toBe("Mon 6");  // 6 days back
    expect(dayLabel(at(2026, 6, 5), NOW)).toBe("5 Jul");  // 7 days back
  });
});

describe("composeBrewedAt", () => {
  it("merges a day start with wall-clock hh:mm", () => {
    expect(composeBrewedAt(at(2026, 6, 12), 7, 5)).toBe(at(2026, 6, 12, 7, 5));
    expect(composeBrewedAt(at(2026, 6, 10), 23, 59)).toBe(at(2026, 6, 10, 23, 59));
  });
});

describe("clampTimePart", () => {
  it("clamps digits to the max and rejects empty/non-numeric input", () => {
    expect(clampTimePart("", 23)).toBeNull();
    expect(clampTimePart("ab", 59)).toBeNull();
    expect(clampTimePart("7", 23)).toBe(7);
    expect(clampTimePart("27", 23)).toBe(23);
    expect(clampTimePart("99", 59)).toBe(59);
    expect(clampTimePart("1a2", 59)).toBe(12);
  });
});

describe("formatBrewedAtValue", () => {
  it("reads like the ledger: day label · 24h time", () => {
    expect(formatBrewedAtValue(NOW, NOW)).toBe("Today · 15:30");
    expect(formatBrewedAtValue(at(2026, 6, 11, 8, 5), NOW)).toBe("Yesterday · 08:05");
    expect(formatBrewedAtValue(at(2026, 6, 10, 7, 40), NOW)).toBe("Fri 10 · 07:40");
    expect(formatBrewedAtValue(at(2026, 5, 12, 7, 40), NOW)).toBe("12 Jun · 07:40");
    expect(formatBrewedAtValue(at(2025, 5, 12, 7, 40), NOW)).toBe("12 Jun 2025 · 07:40");
  });
});

describe("pad2", () => {
  it("zero-pads to two digits", () => {
    expect(pad2(7)).toBe("07");
    expect(pad2(14)).toBe("14");
  });
});
