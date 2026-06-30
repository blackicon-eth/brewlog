import type { ChatMessage } from "./advisor";

// Pull the first balanced {...} object out of an LLM reply that may include code
// fences, <think> remnants, or surrounding prose. Returns null if none parses to an object.
export function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const text = raw.replace(/```json/gi, "```").replace(/```/g, "");
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const v = JSON.parse(text.slice(start, i + 1));
          if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
        } catch {
          /* keep scanning for the next balanced object */
        }
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
  doseG?: number; waterG?: number; grind?: string; waterTempC?: number;
  dripper?: "V60"; pours?: number; pourIntervalS?: number; totalTimeS?: number;
  filterType?: "white" | "unbleached"; notes?: string;
};

const BREW_KEYS_DOC =
  'doseG, waterG, grind, waterTempC, dripper (only "V60"), pours, pourIntervalS, totalTimeS, filterType ("white" or "unbleached"), notes';

export function buildBrewIntakePrompt(text: string): ChatMessage[] {
  const system = [
    "You convert a coffee lover's freeform description of a pour-over brew into JSON.",
    `Return ONLY a JSON object with these keys: ${BREW_KEYS_DOC}.`,
    "Use null for anything not stated. Do not invent values.",
    'dripper may only be "V60". filterType may only be "white" or "unbleached".',
    "doseG, waterG, waterTempC, pours, pourIntervalS, totalTimeS are numbers.",
    "notes holds any leftover taste/descriptive prose. Do not rate the taste.",
  ].join("\n");
  return [{ role: "system", content: system }, { role: "user", content: `Description:\n${text}` }];
}

export function parseBrewIntake(raw: string): BrewIntake {
  const o = extractJson(raw);
  if (!o) return {};
  const out: BrewIntake = {};
  const dose = numFinite(o.doseG); if (dose != null && dose > 0) out.doseG = dose;
  const water = numFinite(o.waterG); if (water != null && water > 0) out.waterG = water;
  const grind = str(o.grind); if (grind) out.grind = grind;
  const temp = numFinite(o.waterTempC); if (temp != null) out.waterTempC = Math.min(100, Math.max(0, temp));
  if (str(o.dripper)?.toLowerCase() === "v60") out.dripper = "V60";
  const pours = intGe(o.pours, 1); if (pours != null) out.pours = pours;
  const interval = intGe(o.pourIntervalS, 0); if (interval != null) out.pourIntervalS = interval;
  const total = intGe(o.totalTimeS, 0); if (total != null) out.totalTimeS = total;
  const filter = str(o.filterType)?.toLowerCase();
  if (filter === "white" || filter === "unbleached") out.filterType = filter;
  const notes = str(o.notes); if (notes) out.notes = notes;
  return out;
}
