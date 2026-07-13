import { MONTHS, WEEKDAYS, formatBrewTime } from "./brewFormat";

const DAY_MS = 86_400_000;

export type DayOption = { key: string; label: string; dayStart: number };

// Local-midnight timestamp of the calendar day containing ts.
export function startOfDayTs(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const pad2 = (n: number): string => String(n).padStart(2, "0");

// Calendar-day label in the ledger's voice: "Today"/"Yesterday", weekday + day-of-month
// inside the picker's week ("Fri 10"), an absolute date beyond it ("12 Jun", year
// appended when it isn't the current one).
export function dayLabel(dayStart: number, now: number): string {
  const diff = Math.round((startOfDayTs(now) - startOfDayTs(dayStart)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const d = new Date(dayStart);
  if (diff < 7) return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// The picker's chips: today through five days back. When `existing` (an edited brew's
// stored time) falls outside that window, its day is prepended so it stays reachable.
export function dayOptions(now: number, existing?: number | null): DayOption[] {
  const opts: DayOption[] = [];
  const today = new Date(startOfDayTs(now));
  for (let i = 0; i < 6; i++) {
    // Day-by-day via the Date constructor so a DST shift can't skew the boundary.
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i).getTime();
    opts.push({ key: String(dayStart), label: dayLabel(dayStart, now), dayStart });
  }
  if (existing != null) {
    const exStart = startOfDayTs(existing);
    if (!opts.some((o) => o.dayStart === exStart)) {
      opts.unshift({ key: String(exStart), label: dayLabel(exStart, now), dayStart: exStart });
    }
  }
  return opts;
}

// Merge a picked day with wall-clock hh:mm (via the Date constructor — DST-safe).
export function composeBrewedAt(dayStart: number, hh: number, mm: number): number {
  const d = new Date(dayStart);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime();
}

// Normalize a typed time part: digits only, clamped to [0, max]. Empty/non-numeric
// input returns null — the caller falls back to the previous value.
export function clampTimePart(text: string, max: number): number | null {
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  return Math.min(parseInt(digits, 10), max);
}

// The form row's value: "Today · 14:32", "Fri 10 · 07:40", "12 Jun 2025 · 07:40".
export function formatBrewedAtValue(ts: number, now: number = Date.now()): string {
  return `${dayLabel(startOfDayTs(ts), now)} · ${formatBrewTime(ts)}`;
}
