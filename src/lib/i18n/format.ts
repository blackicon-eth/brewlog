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

// 24-hour time, e.g. "14:30" — matches the legacy formatBrewTime's zero-padded HH:mm in
// both locales (Italy also reads the clock in 24h).
export function formatBrewTimeLocale(ts: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocaleTag(locale), {
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(ts));
}
