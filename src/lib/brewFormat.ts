import type { Brew } from "../models/types";
import { formatRatio } from "./ratio";

const DAY_MS = 86_400_000;

export function formatSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return "";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Compact, locale-independent brew date, e.g. "28 Jun". Used as the ledger date stamp
// on a brew row (and to make the "Recent" sort legible).
export function formatBrewDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function daysOffRoast(roastDate: string | null | undefined, now: number = Date.now()): number | null {
  if (!roastDate) return null;
  const t = Date.parse(roastDate);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

export function formatBrewLine(brew: Brew, index: number): string {
  const parts: string[] = [`${index})`];
  parts.push(`${brew.doseG}g:${brew.waterG}g (${formatRatio(brew.ratio)})`);
  if (brew.grind) parts.push(`grind ${brew.grind}`);
  if (brew.waterTempC != null) parts.push(`${brew.waterTempC}C`);
  if (brew.dripper) parts.push(brew.dripper);
  if (brew.pours != null) parts.push(`${brew.pours} pours`);
  if (brew.pourIntervalS != null) parts.push(`pour every ${brew.pourIntervalS}s`);
  if (brew.totalTimeS != null) parts.push(formatSeconds(brew.totalTimeS));
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
