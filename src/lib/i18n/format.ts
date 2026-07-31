// Locale-aware number/date/time formatting for UI screens. Pure, no React/Expo imports.
// The plain English formatters (`formatRatio` in ratio.ts, `formatBrewDate`/`formatBrewTime`
// in brewFormat.ts) stay as-is for non-UI callers — ledger filenames, qvac prompts — which
// must stay English regardless of the active locale. These *Locale twins are for screens.
import type { Locale } from "./t";
import { intlLocaleTag } from "./labels";

export function formatNumberLocale(n: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocaleTag(locale), opts).format(n);
}

// "1:16.0" (EN) / "1:16,0" (IT) — same fixed-to-one-decimal shape as the legacy
// formatRatio, with a locale-aware decimal separator.
export function formatRatioLocale(r: number, locale: Locale): string {
  return `1:${formatNumberLocale(r, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

// Compact brew date, e.g. "17 Jul" (EN) / "17 lug" (IT) — day-first like the legacy
// formatBrewDate. Built by hand (day + an Intl month-only name) rather than a combined
// Intl day+month format: Intl's combined order for en-US is "Jul 17", not "17 Jul" —
// see brewedAt.ts's formatDayKind, which uses the same trick for the same reason.
export function formatBrewDateLocale(ts: number, locale: Locale): string {
  const d = new Date(ts);
  const month = new Intl.DateTimeFormat(intlLocaleTag(locale), { month: "short" }).format(d);
  return `${d.getDate()} ${month}`;
}

// "10 Jun 2026" (EN) / "10 giu 2026" (IT) — the roast-date tag on the coffee page.
// Parsed by hand (YYYY-MM-DD → local Date) rather than Date.parse, which reads an ISO
// date-only string as UTC midnight and would shift the day in negative-offset timezones.
// The form field is free text, so a malformed value falls back to the raw string.
export function formatRoastDateLocale(iso: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  const y = Number(m[1]), mo = Number(m[2]), day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return iso.trim();
  const month = new Intl.DateTimeFormat(intlLocaleTag(locale), { month: "short" }).format(d);
  return `${day} ${month} ${y}`;
}

// 24-hour time, e.g. "14:30" — matches the legacy formatBrewTime's zero-padded HH:mm in
// both locales (Italy also reads the clock in 24h).
export function formatBrewTimeLocale(ts: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocaleTag(locale), {
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(ts));
}
