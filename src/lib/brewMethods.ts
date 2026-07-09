// The method shelf: display + behavior metadata for every brew method the ledger logs.
// Single source of truth for the form, detail rows, list meta, AI prompts, and NL
// intake — same registry pattern as the tools shelf. Pure module: no React, no Expo.

export type BrewMethodId = "v60" | "french_press" | "moka" | "espresso";
export type MokaHeat = "low" | "medium" | "high";

// Which blocks the form's Process section renders, in order. "pours" renders the
// #Pours + Interval pair; "time" renders the method's one duration field.
export type ProcessFieldId = "dripper" | "filterType" | "pours" | "preheat" | "heat" | "time";

export type MethodSpec = {
  id: BrewMethodId;
  label: string;          // chips, detail row: "French Press"
  shortLabel: string;     // list meta tag: "Press"
  waterLabel: string;     // waterG's UI label — "Water (g)", or "Yield (g)" for espresso
  waterPlaceholder: string;
  dosePlaceholder: string;
  showTemp: boolean;      // moka has no settable water temperature
  timeLabel: string;      // form label for totalTimeS
  timeDetailLabel: string;// detail-row label for totalTimeS
  timePlaceholder: string;
  ratioNoun: string;      // "dose to water" | "dose to yield" (hero/detail captions)
  process: ProcessFieldId[];
  noun: string;           // AI prompt vocabulary: "pour-over", "moka pot", ...
  adjustables: string;    // what Diagnose may suggest changing for this method
};

export const METHODS: MethodSpec[] = [
  {
    id: "v60", label: "V60", shortLabel: "V60",
    waterLabel: "Water (g)", waterPlaceholder: "250", dosePlaceholder: "15",
    showTemp: true, timeLabel: "Total (s)", timeDetailLabel: "Total time", timePlaceholder: "165",
    ratioNoun: "dose to water",
    process: ["dripper", "filterType", "pours", "time"],
    noun: "pour-over",
    adjustables: "grind, ratio, water temperature, number of pours, pour interval",
  },
  {
    id: "french_press", label: "French Press", shortLabel: "Press",
    waterLabel: "Water (g)", waterPlaceholder: "500", dosePlaceholder: "30",
    showTemp: true, timeLabel: "Steep (s)", timeDetailLabel: "Steep time", timePlaceholder: "240",
    ratioNoun: "dose to water",
    process: ["time"],
    noun: "French press",
    adjustables: "grind, ratio, water temperature, steep time",
  },
  {
    id: "moka", label: "Moka", shortLabel: "Moka",
    waterLabel: "Water (g)", waterPlaceholder: "200", dosePlaceholder: "16",
    showTemp: false, timeLabel: "Total (s)", timeDetailLabel: "Total time", timePlaceholder: "270",
    ratioNoun: "dose to water",
    process: ["preheat", "heat", "time"],
    noun: "moka pot",
    adjustables: "grind, dose, water preheating, heat level",
  },
  {
    id: "espresso", label: "Espresso", shortLabel: "Espresso",
    waterLabel: "Yield (g)", waterPlaceholder: "36", dosePlaceholder: "18",
    showTemp: true, timeLabel: "Shot (s)", timeDetailLabel: "Shot time", timePlaceholder: "28",
    ratioNoun: "dose to yield",
    process: ["time"],
    noun: "espresso",
    adjustables: "grind, dose, yield, shot time, water temperature",
  },
];

export const METHODS_BY_ID = Object.fromEntries(
  METHODS.map((m) => [m.id, m]),
) as Record<BrewMethodId, MethodSpec>;

export function isBrewMethodId(v: unknown): v is BrewMethodId {
  return v === "v60" || v === "french_press" || v === "moka" || v === "espresso";
}

// Unknown or absent ids resolve to the v60 spec — every pre-method brew is a V60
// (mirrors resolveModel's fallback in aiModels.ts).
export function methodSpec(id: string | null | undefined): MethodSpec {
  return isBrewMethodId(id) ? METHODS_BY_ID[id] : METHODS_BY_ID.v60;
}
