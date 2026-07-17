import { formatBrewTime } from "./brewFormat";

const DAY_MS = 86_400_000;

// Which flavor of calendar-day label a given day needs, relative to `now`. Deliberately
// dictionary-free — the caller (which owns the active dictionary + Intl locale) turns
// this into actual words via `formatDayKind`/`dayLabel`, keeping this file pure.
export type DayKind = "today" | "yesterday" | "weekday" | "date";
export type DayOption = { key: string; dayStart: number; kind: DayKind; includeYear: boolean };
// The two ledger-voice words + an Intl locale tag a caller must supply to render a
// DayKind as text (see src/lib/i18n/labels.ts `brewedAtDayLabels`).
export type DayLabels = { today: string; yesterday: string; locale: string };

// Local-midnight timestamp of the calendar day containing ts.
export function startOfDayTs(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const pad2 = (n: number): string => String(n).padStart(2, "0");

// Classifies a calendar day relative to `now`: "today"/"yesterday" for the two special
// cases, "weekday" for the rest of the picker's week, "date" beyond it — `includeYear`
// is true only when that date falls outside the current year. Pure: no display strings.
export function dayKindOf(dayStart: number, now: number): { kind: DayKind; includeYear: boolean } {
  const diff = Math.round((startOfDayTs(now) - startOfDayTs(dayStart)) / DAY_MS);
  if (diff === 0) return { kind: "today", includeYear: false };
  if (diff === 1) return { kind: "yesterday", includeYear: false };
  if (diff < 7) return { kind: "weekday", includeYear: false };
  const includeYear = new Date(dayStart).getFullYear() !== new Date(now).getFullYear();
  return { kind: "date", includeYear };
}

// Renders a classified day in the ledger's voice: the caller's own "Today"/"Yesterday"
// copy, a locale-aware weekday + day-of-month inside the week ("Fri 10", "ven 10"), an
// absolute date beyond it ("12 Jun", year appended when it isn't the current one).
// Weekday/month names come from Intl (keyed off `labels.locale`) so this localizes
// correctly without brewedAt.ts importing the dictionary itself.
export function formatDayKind(dayStart: number, kind: DayKind, includeYear: boolean, labels: DayLabels): string {
  if (kind === "today") return labels.today;
  if (kind === "yesterday") return labels.yesterday;
  const d = new Date(dayStart);
  if (kind === "weekday") {
    const weekday = new Intl.DateTimeFormat(labels.locale, { weekday: "short" }).format(d);
    return `${weekday} ${d.getDate()}`;
  }
  const month = new Intl.DateTimeFormat(labels.locale, { month: "short" }).format(d);
  const base = `${d.getDate()} ${month}`;
  return includeYear ? `${base} ${d.getFullYear()}` : base;
}

// One-call shortcut for dayKindOf + formatDayKind.
export function dayLabel(dayStart: number, now: number, labels: DayLabels): string {
  const { kind, includeYear } = dayKindOf(dayStart, now);
  return formatDayKind(dayStart, kind, includeYear, labels);
}

// The picker's chips: today through five days back. When `existing` (an edited brew's
// stored time) falls outside that window, its day is prepended so it stays reachable.
export function dayOptions(now: number, existing?: number | null): DayOption[] {
  const opts: DayOption[] = [];
  const today = new Date(startOfDayTs(now));
  for (let i = 0; i < 6; i++) {
    // Day-by-day via the Date constructor so a DST shift can't skew the boundary.
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i).getTime();
    const { kind, includeYear } = dayKindOf(dayStart, now);
    opts.push({ key: String(dayStart), dayStart, kind, includeYear });
  }
  if (existing != null) {
    const exStart = startOfDayTs(existing);
    if (!opts.some((o) => o.dayStart === exStart)) {
      const { kind, includeYear } = dayKindOf(exStart, now);
      opts.unshift({ key: String(exStart), dayStart: exStart, kind, includeYear });
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
export function formatBrewedAtValue(ts: number, labels: DayLabels, now: number = Date.now()): string {
  return `${dayLabel(startOfDayTs(ts), now, labels)} · ${formatBrewTime(ts)}`;
}
