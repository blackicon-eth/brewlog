import type { Brew } from "../models/types";
import { formatRatio } from "./ratio";
import { methodSpec } from "./brewMethods";
import { methodPromptLabel } from "./i18n/labels";
import { dayLabel, type DayLabels } from "./brewedAt";

const DAY_MS = 86_400_000;

export function formatSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return "";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Stable per-calendar-day key ("2026-6-2", local time) used to bucket the brew ledger.
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export type BrewDaySection<T extends { brewedAt: number }> = { key: string; title: string; data: T[] };

// Groups brews into per-day sections, preserving the input order (which the DB returns
// newest-first) so both the sections and the rows within them read newest → oldest. The
// section title is rendered in the active locale via brewedAt.ts's `dayLabel` — `labels`
// carries the caller's "Today"/"Yesterday" copy plus an Intl locale tag (see
// `src/lib/i18n/labels.ts` brewedAtDayLabels), keeping this file itself dictionary-free.
export function groupBrewsByDay<T extends { brewedAt: number }>(
  brews: T[],
  labels: DayLabels,
  now: number = Date.now()
): BrewDaySection<T>[] {
  const sections: BrewDaySection<T>[] = [];
  const byKey = new Map<string, BrewDaySection<T>>();
  for (const b of brews) {
    const key = dayKey(b.brewedAt);
    let section = byKey.get(key);
    if (!section) {
      section = { key, title: dayLabel(b.brewedAt, now, labels), data: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.data.push(b);
  }
  return sections;
}

// Compact, locale-independent brew date, e.g. "28 Jun". Used as the ledger date stamp
// on a brew row (and to make the "Recent" sort legible).
export function formatBrewDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// 24-hour time, e.g. "14:30" — shown beside the brew date.
export function formatBrewTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function daysOffRoast(roastDate: string | null | undefined, now: number = Date.now()): number | null {
  if (!roastDate) return null;
  const t = Date.parse(roastDate);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

export function formatBrewLine(brew: Brew, index: number): string {
  const spec = methodSpec(brew.method);
  const out = brew.method === "espresso" ? " out" : "";
  const parts: string[] = [`${index}) ${methodPromptLabel(spec.id)}`];
  parts.push(`${brew.doseG}g:${brew.waterG}g${out} (${formatRatio(brew.ratio)})`);
  if (brew.grind) parts.push(`grind ${brew.grind}`);
  if (brew.waterTempC != null) parts.push(`${brew.waterTempC}C`);
  if (brew.dripper) parts.push(brew.dripper);
  if (brew.pours != null) parts.push(`${brew.pours} pours`);
  if (brew.pourIntervalS != null) parts.push(`pour every ${brew.pourIntervalS}s`);
  if (brew.preheat != null) parts.push(brew.preheat ? "preheated water" : "cold water");
  if (brew.heat) parts.push(`${brew.heat} heat`);
  if (brew.totalTimeS != null) {
    const t = formatSeconds(brew.totalTimeS);
    parts.push(brew.method === "french_press" ? `steep ${t}` : brew.method === "espresso" ? `shot ${t}` : t);
  }
  const taste: string[] = [];
  if (brew.acidity != null) taste.push(`acid${brew.acidity}`);
  if (brew.sweetness != null) taste.push(`sweet${brew.sweetness}`);
  if (brew.bitterness != null) taste.push(`bitter${brew.bitterness}`);
  if (brew.body != null) taste.push(`body${brew.body}`);
  if (brew.clarity != null) taste.push(`clarity${brew.clarity}`);
  if (taste.length) parts.push(`[${taste.join(" ")}]`);
  if (brew.rating != null) parts.push(`${brew.rating}/5 overall`);
  if (brew.notes) parts.push(`"${brew.notes}"`);
  return parts.join(" | ");
}

export function formatBrewsTable(brews: Brew[]): string {
  if (brews.length === 0) return "(no brews)";
  return brews.map((b, i) => formatBrewLine(b, i + 1)).join("\n");
}

export function formatBrewDetail(brew: Brew): string {
  return formatBrewLine(brew, 1).replace(/^1\) /, "");
}

// "today" for the same calendar day, else "Nd ago" — calendar-day difference (matching
// groupBrewsByDay's bucketing), not raw 24h chunks. Used in the chat ledger context lines.
export function formatDaysAgo(ts: number, now: number = Date.now()): string {
  const diffDays = Math.round((startOfDay(new Date(now)) - startOfDay(new Date(ts))) / DAY_MS);
  return diffDays <= 0 ? "today" : `${diffDays}d ago`;
}
