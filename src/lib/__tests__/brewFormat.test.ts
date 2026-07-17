import {
  formatSeconds, daysOffRoast, formatBrewLine, formatBrewsTable, formatBrewDetail,
  dayKey, groupBrewsByDay, formatDaysAgo,
} from "../brewFormat";
import type { DayLabels } from "../brewedAt";
import type { Brew } from "../../models/types";

const EN_LABELS: DayLabels = { today: "Today", yesterday: "Yesterday", locale: "en-US" };
const IT_LABELS: DayLabels = { today: "Oggi", yesterday: "Ieri", locale: "it-IT" };

const at = (s: string) => new Date(s).getTime();

const base: Brew = {
  id: "b1", coffeeId: "c1", brewedAt: 1000, method: "filter" as const, doseG: 15, waterG: 250, ratio: 16.6667,
  grind: "medium-fine", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 30,
  totalTimeS: 165, filterType: null,
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
  const mk = (over: Partial<Brew>): Brew => ({
    id: "b", coffeeId: "c", brewedAt: 0, method: "filter",
    doseG: 15, waterG: 250, ratio: 16.7, createdAt: 0, ...over,
  });

  it("includes index, ratio, grind, temp, time, rating", () => {
    const line = formatBrewLine(base, 1);
    expect(line).toContain("1)");
    expect(line).toContain("Filter");
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

  it("labels a v60 line with its method", () => {
    expect(formatBrewLine(mk({ grind: "medium", waterTempC: 94, pours: 3, totalTimeS: 165 }), 1))
      .toBe("1) Filter | 15g:250g (1:16.7) | grind medium | 94C | 3 pours | 2:45");
  });

  it("formats espresso as yield out with a shot time", () => {
    expect(formatBrewLine(mk({ method: "espresso", doseG: 18, waterG: 36, ratio: 2, totalTimeS: 28 }), 1))
      .toBe("1) Espresso | 18g:36g out (1:2.0) | shot 0:28");
  });

  it("formats a french press steep", () => {
    expect(formatBrewLine(mk({ method: "french_press", doseG: 30, waterG: 500, ratio: 16.7, totalTimeS: 240 }), 1))
      .toBe("1) French Press | 30g:500g (1:16.7) | steep 4:00");
  });

  it("formats moka preheat and heat", () => {
    expect(formatBrewLine(mk({ method: "moka", doseG: 16, waterG: 200, ratio: 12.5, preheat: true, heat: "medium", totalTimeS: 270 }), 1))
      .toBe("1) Moka | 16g:200g (1:12.5) | preheated water | medium heat | 4:30");
  });

  it("says cold water when preheat is explicitly false", () => {
    expect(formatBrewLine(mk({ method: "moka", doseG: 16, waterG: 200, ratio: 12.5, preheat: false }), 1))
      .toBe("1) Moka | 16g:200g (1:12.5) | cold water");
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
    expect(detail.startsWith("Filter | ")).toBe(true);
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

describe("groupBrewsByDay", () => {
  const now = at("2026-07-02T12:00:00");
  const b = (id: string, when: string): Pick<Brew, "brewedAt"> & { id: string } =>
    ({ id, brewedAt: at(when) });

  it("groups consecutive same-day brews under one section, preserving order", () => {
    const sections = groupBrewsByDay(
      [b("a", "2026-07-02T15:00:00"), b("b", "2026-07-02T09:00:00"), b("c", "2026-07-01T09:00:00")],
      EN_LABELS,
      now
    );
    expect(sections.map((s) => s.title)).toEqual(["Today", "Yesterday"]);
    expect(sections[0].data.map((x) => x.id)).toEqual(["a", "b"]);
    expect(sections[1].data.map((x) => x.id)).toEqual(["c"]);
  });

  it("returns no sections for an empty list", () => {
    expect(groupBrewsByDay([], EN_LABELS, now)).toEqual([]);
  });

  it("labels the current day 'Today'", () => {
    const sections = groupBrewsByDay([b("a", "2026-07-02T07:00:00")], EN_LABELS, now);
    expect(sections[0].title).toBe("Today");
  });

  it("labels the prior day 'Yesterday'", () => {
    const sections = groupBrewsByDay([b("a", "2026-07-01T22:00:00")], EN_LABELS, now);
    expect(sections[0].title).toBe("Yesterday");
  });

  it("uses a weekday + day-of-month within the past week", () => {
    // Jun 28 is 4 days before `now` (Jul 2), inside brewedAt.ts's "weekday" window (<7 days).
    const sections = groupBrewsByDay([b("a", "2026-06-28T10:00:00")], EN_LABELS, now);
    expect(sections[0].title).toBe("Sun 28");
  });

  it("uses day + month (+ year if different) beyond the past week", () => {
    const sections = groupBrewsByDay([b("a", "2025-12-31T10:00:00")], EN_LABELS, now);
    expect(sections[0].title).toBe("31 Dec 2025");
  });

  it("renders Italian day labels via the Italian locale tag", () => {
    const today = groupBrewsByDay([b("a", "2026-07-02T07:00:00")], IT_LABELS, now);
    expect(today[0].title).toBe("Oggi");

    const yesterday = groupBrewsByDay([b("a", "2026-07-01T22:00:00")], IT_LABELS, now);
    expect(yesterday[0].title).toBe("Ieri");

    const older = groupBrewsByDay([b("a", "2026-06-28T10:00:00")], IT_LABELS, now);
    expect(older[0].title).toMatch(/^dom 28$/i);
  });
});

describe("formatDaysAgo", () => {
  // Local-time strings (via the file's `at()` helper), matching every other describe block
  // here — startOfDay buckets by local calendar day, so UTC-"Z" timestamps would make this
  // test's day-boundary math depend on the machine's timezone.
  const now = at("2026-06-20T12:00:00");
  it("says 'today' for the same calendar day", () => {
    expect(formatDaysAgo(at("2026-06-20T01:00:00"), now)).toBe("today");
  });
  it("counts whole calendar days elapsed", () => {
    expect(formatDaysAgo(at("2026-06-18T23:00:00"), now)).toBe("2d ago");
    expect(formatDaysAgo(at("2026-06-08T00:00:00"), now)).toBe("12d ago");
  });
});
