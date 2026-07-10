import type { ChatMessage } from "./advisor";
import { isBrewMethodId, type BrewMethodId, type MokaHeat } from "../lib/brewMethods";

// Pull the first balanced {...} object out of an LLM reply that may include code
// fences, <think> remnants, or surrounding prose. Returns null if none parses to an object.
export function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const text = raw.replace(/```json/gi, "```").replace(/```/g, "");
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const v = JSON.parse(text.slice(start, i + 1));
          if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
        } catch { /* keep scanning */ }
        start = -1;
      }
    }
  }
  return null;
}

const str = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
};
const numFinite = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const intGe = (v: unknown, min: number): number | undefined => {
  const n = numFinite(v);
  if (n == null) return undefined;
  const i = Math.round(n);
  return i >= min ? i : undefined;
};

export type BrewIntake = {
  method?: BrewMethodId;
  doseG?: number; waterG?: number; grind?: string; waterTempC?: number;
  pours?: number; pourIntervalS?: number; totalTimeS?: number;
  filterType?: "white" | "unbleached"; preheat?: boolean; heat?: MokaHeat; notes?: string;
};

const BREW_KEYS_DOC =
  'method ("filter", "french_press", "moka" or "espresso"), doseG, waterG, grind, waterTempC, ' +
  'pours, pourIntervalS, totalTimeS, filterType ("white" or "unbleached"), ' +
  'preheat (true/false, moka only), heat ("low", "medium" or "high", moka only), notes';

export function buildBrewIntakePrompt(text: string): ChatMessage[] {
  const system = [
    "You convert a coffee lover's freeform description of a coffee brew into JSON.",
    `Return ONLY a JSON object with these keys: ${BREW_KEYS_DOC}.`,
    "Use null for anything not stated. Do not invent values.",
    'V60 and other paper-filter drippers count as method "filter". filterType may only be "white" or "unbleached".',
    "doseG, waterG, waterTempC, pours, pourIntervalS, totalTimeS are numbers.",
    "For espresso, waterG is the beverage yield out in grams.",
    "notes holds any leftover taste/descriptive prose. Do not rate the taste.",
  ].join("\n");
  return [{ role: "system", content: system }, { role: "user", content: `Description:\n${text}` }];
}

export function parseBrewIntake(raw: string): BrewIntake {
  const o = extractJson(raw);
  if (!o) return {};
  const out: BrewIntake = {};
  const methodRaw = str(o.method)?.toLowerCase().replace(/[\s-]+/g, "_");
  // Common labels the model may echo back map onto the stored ids ("v60" is the
  // pre-rename id for filter brews and still shows up in old exports and habits).
  const method =
    methodRaw === "frenchpress" ? "french_press" :
      methodRaw === "v60" || methodRaw === "pour_over" || methodRaw === "pourover" ? "filter" :
        methodRaw;
  if (isBrewMethodId(method)) out.method = method;
  const dose = numFinite(o.doseG); if (dose != null && dose > 0) out.doseG = dose;
  const water = numFinite(o.waterG); if (water != null && water > 0) out.waterG = water;
  const grind = str(o.grind); if (grind) out.grind = grind;
  const temp = numFinite(o.waterTempC); if (temp != null) out.waterTempC = Math.min(100, Math.max(0, temp));
  const pours = intGe(o.pours, 1); if (pours != null) out.pours = pours;
  const interval = intGe(o.pourIntervalS, 0); if (interval != null) out.pourIntervalS = interval;
  const total = intGe(o.totalTimeS, 0); if (total != null) out.totalTimeS = total;
  const filter = str(o.filterType)?.toLowerCase();
  if (filter === "white" || filter === "unbleached") out.filterType = filter;
  if (typeof o.preheat === "boolean") out.preheat = o.preheat;
  const heat = str(o.heat)?.toLowerCase();
  if (heat === "low" || heat === "medium" || heat === "high") out.heat = heat;
  const notes = str(o.notes); if (notes) out.notes = notes;
  return out;
}

export type CoffeeIntake = {
  roaster?: string; name?: string; origin?: string; process?: string;
  roastLevel?: string; roastDate?: string; notes?: string;
};

const COFFEE_KEYS_DOC =
  "roaster, name, origin, process (e.g. washed/natural/honey), roastLevel (e.g. light/medium), roastDate (YYYY-MM-DD), notes";

export function buildCoffeeIntakePrompt(text: string): ChatMessage[] {
  const system = [
    "You convert a coffee lover's freeform description of a bag of coffee into JSON.",
    `Return ONLY a JSON object with these keys: ${COFFEE_KEYS_DOC}.`,
    "Use null for anything not stated. Do not invent values.",
    "roastDate must be YYYY-MM-DD or null. notes holds any leftover descriptive/tasting prose.",
  ].join("\n");
  return [{ role: "system", content: system }, { role: "user", content: `Description:\n${text}` }];
}

export function parseCoffeeIntake(raw: string): CoffeeIntake {
  const o = extractJson(raw);
  if (!o) return {};
  const out: CoffeeIntake = {};
  const roaster = str(o.roaster); if (roaster) out.roaster = roaster;
  const name = str(o.name); if (name) out.name = name;
  const origin = str(o.origin); if (origin) out.origin = origin;
  const process = str(o.process); if (process) out.process = process;
  const roastLevel = str(o.roastLevel); if (roastLevel) out.roastLevel = roastLevel;
  const roastDate = str(o.roastDate);
  if (roastDate && /^\d{4}-\d{2}-\d{2}$/.test(roastDate)) out.roastDate = roastDate;
  const notes = str(o.notes); if (notes) out.notes = notes;
  return out;
}
