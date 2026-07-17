// Pure lookup helpers for method display strings. No React, no Expo.
// The dictionary carries the localizable copy (label, shortLabel, water/time labels,
// ratio noun); brewMethods.ts keeps only the English prompt vocabulary (noun, adjustables)
// and behavioral metadata (showTemp, process). Numeric placeholders are locale-independent
// and live here as plain functions, not dictionary entries.
import type { Dict } from "./en";
import { en } from "./en";
import type { Locale } from "./t";
import { METHODS, methodSpec, type BrewMethodId } from "../brewMethods";
import type { ToolId } from "../../screens/tools/types";
import type { ExAxis, StrAxis } from "../coffeeCompass";
import type { EyBand } from "../extraction";

// Normalizes legacy/unknown ids (e.g. the pre-rename "v60") to a real BrewMethodId the
// same way methodSpec does, so every helper here shares one fallback rule.
function normalize(id: BrewMethodId | string | null | undefined): BrewMethodId {
  return methodSpec(id).id;
}

export function methodLabel(dict: Dict, id: BrewMethodId): string {
  return dict.methods[normalize(id)].label;
}

export function methodShortLabel(dict: Dict, id: BrewMethodId): string {
  return dict.methods[normalize(id)].shortLabel;
}

export function methodWaterLabel(dict: Dict, id: BrewMethodId): string {
  return dict.methods[normalize(id)].waterLabel;
}

export function methodTimeLabel(dict: Dict, id: BrewMethodId): string {
  return dict.methods[normalize(id)].timeLabel;
}

export function methodTimeDetailLabel(dict: Dict, id: BrewMethodId): string {
  return dict.methods[normalize(id)].timeDetailLabel;
}

export function methodRatioNoun(dict: Dict, id: BrewMethodId): string {
  return dict.methods[normalize(id)].ratioNoun;
}

// English-only — used by prompt builders under src/qvac and src/lib/brewFormat.ts, which
// must stay English regardless of the active locale.
export function methodPromptLabel(id: BrewMethodId): string {
  return methodLabel(en, id);
}

const DOSE_PLACEHOLDERS: Record<BrewMethodId, string> = {
  filter: "15", french_press: "30", moka: "16", espresso: "18",
};
const WATER_PLACEHOLDERS: Record<BrewMethodId, string> = {
  filter: "250", french_press: "500", moka: "200", espresso: "36",
};
const TIME_PLACEHOLDERS: Record<BrewMethodId, string> = {
  filter: "165", french_press: "240", moka: "270", espresso: "28",
};

export function methodDosePlaceholder(id: BrewMethodId): string {
  return DOSE_PLACEHOLDERS[normalize(id)];
}

export function methodWaterPlaceholder(id: BrewMethodId): string {
  return WATER_PLACEHOLDERS[normalize(id)];
}

export function methodTimePlaceholder(id: BrewMethodId): string {
  return TIME_PLACEHOLDERS[normalize(id)];
}

// Method shelf, in shelf order (the METHODS registry, not object key order), for
// ChipSelect option lists.
export function methodOptions(dict: Dict): { label: string; value: BrewMethodId }[] {
  return METHODS.map((m) => ({ label: dict.methods[m.id].label, value: m.id }));
}

// Tool grid/page copy — the meta type itself carries only the id; display strings live
// here so the Tools shelf and each tool's page chrome resolve them per locale.
export function toolTitle(dict: Dict, id: ToolId): string {
  return dict.tools[id].title;
}

export function toolBlurb(dict: Dict, id: ToolId): string {
  return dict.tools[id].blurb;
}

// The Coffee Compass's 3×3 taste-verdict cells: src/lib/coffeeCompass.ts `classify` only
// returns the (exAxis, strAxis) ids it lands on, so the actual title/advice copy is resolved
// here from the dictionary, keeping the lib locale-free.
export function compassCellText(dict: Dict, exAxis: ExAxis, strAxis: StrAxis): { title: string; advice: string } {
  return dict.tools.compass.page.cells[exAxis][strAxis];
}

// The Extraction Yield tool's under/ideal/over verdict + note, keyed by the band id
// src/lib/extraction.ts `band()` returns — same reasoning as compassCellText above.
export function extractionBandText(dict: Dict, b: EyBand): { verdict: string; note: string } {
  return dict.tools.extraction.page.bands[b];
}

// AI model shelf note, keyed by the @qvac/sdk constant id. Falls back to the id itself for
// a model no longer in the dictionary (e.g. a stale stored selection), matching
// resolveModel's own never-throw fallback rule in aiModels.ts.
export function aiModelNote(dict: Dict, modelId: string): string {
  const note = (dict.aiModels as Record<string, unknown>)[modelId];
  return typeof note === "string" ? note : modelId;
}

// BCP-47 tag for Intl calls (weekday/month names) that must track the active locale.
const INTL_LOCALE: Record<Locale, string> = { en: "en-US", it: "it-IT" };

export function intlLocaleTag(locale: Locale): string {
  return INTL_LOCALE[locale];
}

// The bits src/lib/brewedAt.ts needs to render a classified calendar day (see
// `formatDayKind`/`dayLabel` there) in the active locale — assembled here, not in
// brewedAt.ts, so that file can stay dictionary-free and pure.
export function brewedAtDayLabels(dict: Dict, locale: Locale): { today: string; yesterday: string; locale: string } {
  return { today: dict.brewedAt.today, yesterday: dict.brewedAt.yesterday, locale: intlLocaleTag(locale) };
}
