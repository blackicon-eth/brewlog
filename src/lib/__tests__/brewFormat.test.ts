import {
  formatSeconds, daysOffRoast, formatBrewLine, formatBrewsTable, formatBrewDetail,
  dayKey, formatDayHeader, groupBrewsByDay,
} from "../brewFormat";
import type { Brew } from "../../models/types";

const at = (s: string) => new Date(s).getTime();

const base: Brew = {
  id: "b1", coffeeId: "c1", brewedAt: 1000, method: "v60" as const, doseG: 15, waterG: 250, ratio: 16.6667,
  grind: "medium-fine", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 30,
  totalTimeS: 165, filterType: null, tds: null, ey: null,
  acidity: 4, sweetness: 3, bitterness: 2, body: 3, clarity: 4, rating: 4,
  notes: "fruity, a touch sharp", createdAt: 1000,
};

describe("formatSeconds", () => {
  it("formats m:ss", () => { expect(formatSeconds(165)).toBe("2:45"); });
  it("pads seconds", () => { expect(formatSeconds(125)).toBe("2:05"); });
  it("returns empty string for nullish", () => { expect(formatSeconds(null)).toBe(""); });
});

describe("daysOffRoast", () => {
  it("computes whole days between roast date and now", () => {
    const now = Date.parse("2026-06-20T00:00:00Z");
    expect(daysOffRoast("2026-06-10", now)).toBe(10);
  });
  it("returns null when no roast date", () => { expect(daysOffRoast(null)).toBeNull(); });
  it("returns null for an invalid date string", () => {
    expect(daysOffRoast("not-a-date")).toBeNull();
  });
});

describe("formatBrewLine", () => {
  it("includes index, ratio, grind, temp, time, rating", () => {
    const line = formatBrewLine(base, 1);
    expect(line).toContain("1)");
    expect(line).toContain("15g:250g");
    expect(line).toContain("1:16.7");
    expect(line).toContain("medium-fine");
    expect(line).toContain("94");
    expect(line).toContain("2:45");
    expect(line).toContain("4/5");
  });
  it("omits fields that are null", () => {
    const sparse: Brew = { ...base, grind: null, waterTempC: null, rating: null };
    const line = formatBrewLine(sparse, 2);
    expect(line).not.toContain("grind");
    expect(line).not.toContain("/5 overall");
  });
});

describe("formatBrewsTable", () => {
  it("numbers rows in order", () => {
    const table = formatBrewsTable([base, { ...base, id: "b2" }]);
    expect(table).toContain("1)");
    expect(table).toContain("2)");
  });
  it("handles empty", () => { expect(formatBrewsTable([])).toBe("(no brews)"); });
});

describe("formatBrewDetail", () => {
  it("returns brew content without leading index prefix", () => {
    const detail = formatBrewDetail(base);
    expect(detail.startsWith("1) ")).toBe(false);
    expect(detail).toContain("1:16.7");
    expect(detail).toContain("15g:250g");
  });
});

describe("dayKey", () => {
  it("collapses different times on the same calendar day to one key", () => {
    expect(dayKey(at("2026-07-02T08:00:00"))).toBe(dayKey(at("2026-07-02T23:30:00")));
  });
  it("separates adjacent days", () => {
    expect(dayKey(at("2026-07-02T23:30:00"))).not.toBe(dayKey(at("2026-07-03T00:10:00")));
  });
});

describe("formatDayHeader", () => {
  const now = at("2026-07-02T12:00:00");
  it("labels the current day 'Today'", () => {
    expect(formatDayHeader(at("2026-07-02T07:00:00"), now)).toBe("Today");
  });
  it("labels the prior day 'Yesterday'", () => {
    expect(formatDayHeader(at("2026-07-01T22:00:00"), now)).toBe("Yesterday");
  });
  it("uses weekday + date for older days in the same year", () => {
    expect(formatDayHeader(at("2026-06-28T10:00:00"), now)).toBe("Sun, 28 Jun");
  });
  it("appends the year for days in a different year", () => {
    expect(formatDayHeader(at("2025-12-31T10:00:00"), now)).toBe("Wed, 31 Dec 2025");
  });
});

describe("groupBrewsByDay", () => {
  const now = at("2026-07-02T12:00:00");
  const b = (id: string, when: string): Pick<Brew, "brewedAt"> & { id: string } =>
    ({ id, brewedAt: at(when) });

  it("groups consecutive same-day brews under one section, preserving order", () => {
    const sections = groupBrewsByDay(
      [b("a", "2026-07-02T15:00:00"), b("b", "2026-07-02T09:00:00"), b("c", "2026-07-01T09:00:00")],
      now
    );
    expect(sections.map((s) => s.title)).toEqual(["Today", "Yesterday"]);
    expect(sections[0].data.map((x) => x.id)).toEqual(["a", "b"]);
    expect(sections[1].data.map((x) => x.id)).toEqual(["c"]);
  });

  it("returns no sections for an empty list", () => {
    expect(groupBrewsByDay([], now)).toEqual([]);
  });
});
