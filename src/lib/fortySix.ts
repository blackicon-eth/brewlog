// --- 4:6 Method (Tetsu Kasuya) Phased Recipe Builder --------------------------------------
// Generates an adjustable staged pour list for Tetsu Kasuya's 4:6 method. The schedule
// depends only on total brew water, which splits into two phases: the first 40% (2 pours)
// tunes acidity/sweetness ("Taste"), the final 60% (N pours, evenly split) tunes
// strength/body ("Strength"). More phase-60 pours yields a stronger cup; fewer pours, a
// lighter one. Pours land roughly every 45s.

export const PHASE40_SHARE = 0.4;
export const PHASE60_SHARE = 0.6;
export const POUR_INTERVAL_S = 45;

export const MIN_PHASE60_POURS = 1;
export const MAX_PHASE60_POURS = 4;
export const DEFAULT_PHASE60_POURS = 3;

// Kasuya's canonical brew: 300g water (20g dose at 1:15 — the dose is the drinker's
// business; the pour schedule only needs the water).
export const DEFAULT_WATER_G = 300;

// The "first pour smaller -> sweeter, larger -> brighter" knob from the original 4:6 write-up:
// it biases how the 40% phase splits across its 2 pours while keeping their sum fixed.
// Balanced is an even 50/50 split (the default).
export type FirstPourBias = "sweeter" | "balanced" | "brighter";

const BIAS_FIRST_SHARE: Record<FirstPourBias, number> = {
  sweeter: 0.4, // smaller first pour
  balanced: 0.5,
  brighter: 0.6, // larger first pour
};

export type PhasedPour = {
  index: number; // 1-based pour number across the whole recipe
  phase: "taste" | "strength"; // "taste" = phase 40, "strength" = phase 60
  pourG: number; // this pour's own amount, rounded to whole grams
  cumulativeG: number; // running total after this pour, rounded to whole grams
  atSeconds: number; // approximate timestamp this pour begins
};

export type FortySixInput = {
  totalWaterG: number;
  phase60Pours?: number; // N, default 3, clamped to [1, 4]
  firstPourBias?: FirstPourBias; // default "balanced"
};

export type FortySixRecipe = {
  totalWaterG: number;
  phase40G: number;
  phase60G: number;
  phase60Pours: number;
  pours: PhasedPour[];
  totalSeconds: number;
};

// Soft-clamp phase-60 pour count into the supported [1, 4] range.
export function clampPhase60Pours(n: number): number {
  const rounded = Math.round(n);
  return Math.min(MAX_PHASE60_POURS, Math.max(MIN_PHASE60_POURS, rounded));
}

// Split a total gram amount across `count` pours as evenly as possible, rounding each pour
// to a whole gram while guaranteeing the pours sum EXACTLY to the (already-rounded) total —
// any rounding remainder is folded into the final pour so the cumulative target is exact.
function splitEven(totalG: number, count: number): number[] {
  const base = Math.floor(totalG / count);
  const amounts = new Array(count).fill(base);
  const remainder = totalG - base * count;
  amounts[amounts.length - 1] += remainder;
  return amounts;
}

// Build the full staged pour list for a 4:6 recipe. Guards invalid input (totalWaterG <= 0
// or NaN) by returning an empty pour list with zeroed totals rather than NaN pours.
export function buildFortySix({ totalWaterG: rawWaterG, phase60Pours = DEFAULT_PHASE60_POURS, firstPourBias = "balanced" }: FortySixInput): FortySixRecipe {
  const n = clampPhase60Pours(phase60Pours);

  if (!rawWaterG || rawWaterG <= 0) {
    return { totalWaterG: 0, phase40G: 0, phase60G: 0, phase60Pours: n, pours: [], totalSeconds: 0 };
  }

  const totalWaterG = Math.round(rawWaterG);
  const phase40G = Math.round(totalWaterG * PHASE40_SHARE);
  const phase60G = totalWaterG - phase40G; // exact complement, avoids a rounding gap

  const firstShare = BIAS_FIRST_SHARE[firstPourBias];
  const firstPourG = Math.round(phase40G * firstShare);
  const secondPourG = phase40G - firstPourG;
  const phase40Amounts = [firstPourG, secondPourG];

  const phase60Amounts = splitEven(phase60G, n);

  const amounts = [...phase40Amounts, ...phase60Amounts];
  const pours: PhasedPour[] = [];
  let cumulative = 0;
  amounts.forEach((pourG, i) => {
    cumulative += pourG;
    pours.push({
      index: i + 1,
      phase: i < 2 ? "taste" : "strength",
      pourG,
      cumulativeG: cumulative,
      atSeconds: i * POUR_INTERVAL_S,
    });
  });

  const totalSeconds = (amounts.length - 1) * POUR_INTERVAL_S;

  return { totalWaterG, phase40G, phase60G, phase60Pours: n, pours, totalSeconds };
}
