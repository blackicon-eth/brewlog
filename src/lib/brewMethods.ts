// The method shelf: display + behavior metadata for every brew method the ledger logs.
// Single source of truth for the form, detail rows, list meta, AI prompts, and NL
// intake — same registry pattern as the tools shelf. Pure module: no React, no Expo.

import type { Brew } from "../models/types";

export type BrewMethodId = "filter" | "french_press" | "moka" | "espresso";
export type MokaHeat = "low" | "medium" | "high";

// Which blocks the form's Process section renders, in order. "pours" renders the
// #Pours + Interval pair; "time" renders the method's one duration field.
// (Brew.dripper survives as a legacy data field, but no method offers it as input.)
export type ProcessFieldId = "filterType" | "pours" | "preheat" | "heat" | "time";

export type MethodSpec = {
  id: BrewMethodId;
  showTemp: boolean;      // moka has no settable water temperature
  process: ProcessFieldId[];
  noun: string;           // AI prompt vocabulary: "pour-over", "moka pot", ...
  adjustables: string;    // what Diagnose may suggest changing for this method
};

// Display strings (label, shortLabel, water/time labels, ratio noun) and numeric
// placeholders live in src/lib/i18n — see labels.ts and the dictionaries' `methods`
// branch — so they can be localized. This registry keeps only English prompt
// vocabulary and behavioral metadata.
export const METHODS: MethodSpec[] = [
  {
    id: "filter",
    showTemp: true,
    process: ["filterType", "pours", "time"],
    noun: "pour-over",
    adjustables: "grind, ratio, water temperature, number of pours, pour interval",
  },
  {
    id: "french_press",
    showTemp: true,
    process: ["time"],
    noun: "French press",
    adjustables: "grind, ratio, water temperature, steep time",
  },
  {
    id: "moka",
    showTemp: false,
    // No "time" block: moka duration tracks pot size more than technique, so it isn't logged.
    process: ["preheat", "heat"],
    noun: "moka pot",
    adjustables: "grind, dose, water preheating, heat level",
  },
  {
    id: "espresso",
    showTemp: true,
    process: ["time"],
    noun: "espresso",
    adjustables: "grind, dose, yield, shot time, water temperature",
  },
];

export const METHODS_BY_ID = Object.fromEntries(
  METHODS.map((m) => [m.id, m]),
) as Record<BrewMethodId, MethodSpec>;

export function isBrewMethodId(v: unknown): v is BrewMethodId {
  return v === "filter" || v === "french_press" || v === "moka" || v === "espresso";
}

// Unknown or absent ids resolve to the filter spec — pre-rename rows/files stored
// "v60", and any unrecognized method is safest read as a plain filter brew
// (mirrors resolveModel's fallback in aiModels.ts).
export function methodSpec(id: string | null | undefined): MethodSpec {
  return isBrewMethodId(id) ? METHODS_BY_ID[id] : METHODS_BY_ID.filter;
}

// A brew-ledger filter choice: one concrete method, or "all" (no filter).
export type MethodFilter = BrewMethodId | "all";

// Turn a filter choice into a SQL WHERE fragment (without the "WHERE" keyword). Columns are
// UNQUALIFIED (`method`, not `b.method`) so the same fragment drops into both the joined list
// query and the bare COUNT query — `coffees` has no `method` column, so it's unambiguous.
//
// The "filter" case mirrors methodSpec's fallback: a stored method that is NULL, the legacy
// "v60", or any unknown value resolves to `filter`, so the filter view must match all of them.
// "filter" itself isn't in the excluded three, so it matches too.
export function methodFilterSql(filter: MethodFilter): { clause: string; params: string[] } {
  if (filter === "all") return { clause: "", params: [] };
  if (filter === "filter") {
    return { clause: "(method IS NULL OR method NOT IN ('french_press','moka','espresso'))", params: [] };
  }
  return { clause: "method = ?", params: [filter] };
}

// Which method should a per-coffee default land on? The most-brewed method for this
// coffee (ties → METHODS shelf order; nothing logged → filter). Pure — used by the
// recipe screen's method default and previously by the removed method picker.
export function defaultPickerMethod(brews: Brew[]): BrewMethodId {
  let best: BrewMethodId = "filter";
  let bestCount = -1;
  for (const m of METHODS) {
    const count = brews.filter((b) => b.method === m.id).length;
    if (count > bestCount) { best = m.id; bestCount = count; }
  }
  return best;
}
