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
// as an inset rectangle, not the whole chart. Both axes center on the target's midpoint
// (EY 20, TDS 1.25) so the box sits dead-center of the plot. Callers may pass their own.
export const DEFAULT_RANGES = {
  ey: { min: 14, max: 26 },
  tds: { min: 1.0, max: 1.5 },
} as const;

// A sensible in-box starting point (dead-centre of the target box).
export const DEFAULT_POINT = { ey: 20, tds: 1.25 } as const;

export type ExAxis = "under" | "ideal" | "over";
export type StrAxis = "weak" | "ideal" | "strong";

export type Verdict = {
  exAxis: ExAxis;
  strAxis: StrAxis;
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

// The taste headline + fix for each of the 9 (exAxis × strAxis) cells lives in the
// dictionary now (tools.compass.page.cells), not here — this lib only classifies which
// cell a reading falls into. See src/lib/i18n/labels.ts `compassCellText`.

/** Classify a brew by its extraction (EY%) and strength (TDS%) into a verdict cell. */
export function classify(ey: number, tds: number): Verdict {
  const exAxis = exAxisOf(ey);
  const strAxis = strAxisOf(tds);
  return {
    exAxis,
    strAxis,
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
