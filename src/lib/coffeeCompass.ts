// Coffee Compass — the deterministic taste-troubleshooting model behind the Brewing
// Control Chart. Two orthogonal axes describe a brew:
//   • Extraction% (EY) — how much of the dry coffee mass dissolved (completeness).
//     Moved by GRIND / TIME / AGITATION. Target band 18–22%.
//   • Strength (TDS%)  — concentration in the cup. Moved by RATIO (coffee:water).
//     Target band 1.15–1.35%.
// The overlap (EY 18–22 × TDS 1.15–1.35) is the "zone of deliciousness". Position
// relative to that box maps to one of nine verdict cells, each with a concrete fix.

// ── Target box (the "zone of deliciousness") ────────────────────────────────────
export const TARGET = {
  ey: { min: 18, max: 22 },
  tds: { min: 1.15, max: 1.35 },
} as const;

// Default plot ranges — a comfortable window around the target box so the box reads
// as an inset rectangle, not the whole chart. Callers may pass their own.
export const DEFAULT_RANGES = {
  ey: { min: 12, max: 28 },
  tds: { min: 1.0, max: 1.6 },
} as const;

// A sensible in-box starting point (dead-centre of the target box).
export const DEFAULT_POINT = { ey: 20, tds: 1.25 } as const;

export type ExAxis = "under" | "ideal" | "over";
export type StrAxis = "weak" | "ideal" | "strong";

export type Verdict = {
  exAxis: ExAxis;
  strAxis: StrAxis;
  /** Short taste headline, e.g. "Sour & watery". */
  title: string;
  /** One concrete fix sentence combining both axes. */
  advice: string;
  /** True only for the dialed-in centre cell. */
  ideal: boolean;
};

type Range = { min: number; max: number };
export type Ranges = { ey: Range; tds: Range };

// ── Axis classification ─────────────────────────────────────────────────────────
export function exAxisOf(ey: number): ExAxis {
  if (ey < TARGET.ey.min) return "under";
  if (ey > TARGET.ey.max) return "over";
  return "ideal";
}

export function strAxisOf(tds: number): StrAxis {
  if (tds < TARGET.tds.min) return "weak";
  if (tds > TARGET.tds.max) return "strong";
  return "ideal";
}

// The 3×3 lookup: taste headline + fix for every combination of the two axes. Authored
// statically (verified brewing advice) rather than generated so the copy stays exact.
const CELLS: Record<ExAxis, Record<StrAxis, { title: string; advice: string }>> = {
  under: {
    weak: {
      title: "Sour & watery",
      advice: "Under-extracted and thin — grind finer (or brew longer) AND use more coffee for a tighter ratio.",
    },
    ideal: {
      title: "Sour & sharp",
      advice: "Good strength but under-extracted — grind finer, brew longer, or add agitation to dissolve more.",
    },
    strong: {
      title: "Sour & heavy",
      advice: "Under-extracted yet over-concentrated — grind finer to extract more AND cut coffee for a wider ratio.",
    },
  },
  ideal: {
    weak: {
      title: "Balanced but thin",
      advice: "Extraction is dialed in — just use more coffee (a tighter ratio) to build body.",
    },
    ideal: {
      title: "Dialed in",
      advice: "Right in the zone of deliciousness — balanced extraction and strength. Brew it again exactly like this.",
    },
    strong: {
      title: "Balanced but heavy",
      advice: "Extraction is dialed in — just use less coffee (a wider ratio) to lighten the cup.",
    },
  },
  over: {
    weak: {
      title: "Bitter & thin",
      advice: "Over-extracted and watery — grind coarser (or shorten the brew) AND use more coffee to firm up the body.",
    },
    ideal: {
      title: "Bitter & dry",
      advice: "Good strength but over-extracted — grind coarser, shorten the brew, or ease off agitation.",
    },
    strong: {
      title: "Bitter & heavy",
      advice: "Over-extracted and over-concentrated — grind coarser to pull less AND cut coffee for a wider ratio.",
    },
  },
};

/** Classify a brew by its extraction (EY%) and strength (TDS%) into a verdict cell. */
export function classify(ey: number, tds: number): Verdict {
  const exAxis = exAxisOf(ey);
  const strAxis = strAxisOf(tds);
  const cell = CELLS[exAxis][strAxis];
  return {
    exAxis,
    strAxis,
    title: cell.title,
    advice: cell.advice,
    ideal: exAxis === "ideal" && strAxis === "ideal",
  };
}

// ── Plot geometry ────────────────────────────────────────────────────────────────
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Map (ey, tds) to fractional plot coordinates within `ranges`.
 * x grows left→right with EY. y is measured FROM THE TOP, so higher TDS (stronger,
 * plotted higher on the chart) yields a SMALLER y. Both clamped to [0, 1].
 */
export function plotPos(ey: number, tds: number, ranges: Ranges = DEFAULT_RANGES): { x: number; y: number } {
  const x = clamp01((ey - ranges.ey.min) / (ranges.ey.max - ranges.ey.min));
  const yUp = clamp01((tds - ranges.tds.min) / (ranges.tds.max - ranges.tds.min));
  return { x, y: 1 - yUp };
}

/** Fractional rect of the target box within `ranges`, as {left, right, top, bottom} in [0,1]. */
export function targetRect(ranges: Ranges = DEFAULT_RANGES): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const left = plotPos(TARGET.ey.min, TARGET.tds.min, ranges);
  const right = plotPos(TARGET.ey.max, TARGET.tds.max, ranges);
  return {
    left: left.x,
    right: right.x,
    // right corresponds to the (max ey, max tds) point → its y is the TOP of the box.
    top: right.y,
    bottom: left.y,
  };
}
