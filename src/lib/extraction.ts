// Extraction Yield (TDS → EY) math — the "coffee science" bench tool.
//
// A refractometer reads the total dissolved solids (TDS%) of the brewed coffee. Combined
// with the beverage weight (coffee actually in the cup) and the dry dose, that yields the
// extraction yield (EY%) — the fraction of the ground coffee's mass that dissolved into the
// cup. EY is the number baristas chase: too low tastes sour/under-developed, too high tastes
// bitter/over-extracted, and a sweet band sits in between.
//
//   EY%  =  (beverageWeightG × TDS%) / doseG
//
// Worked check: 36 g beverage × 10% / 18 g dose = 20% EY.
//
// NOTE — the refuted shortcut `EY = TDS% × waterG / doseG` is deliberately NOT implemented.
// Water weight overstates the liquid in the cup (grounds retain ~2 g/g of water), so the
// beverage must be weighed on a scale — anyone with a refractometer has one.

// Ideal extraction-yield band (percent). Below is under-extracted (sour), above is
// over-extracted (bitter), between is the balanced/sweet target.
export const EY_IDEAL_MIN = 18;
export const EY_IDEAL_MAX = 22;

export type EyBand = "under" | "ideal" | "over";

// A finite positive number, or 0. Guards the NaN/Infinity a stray "." or empty field would
// otherwise leak into the readout while the user is still typing.
function positive(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// EY% = beverage × TDS / dose. Returns 0 (not NaN) when any input is missing or dose ≤ 0,
// so the UI can render a neutral "—" instead of special-casing a broken value. Rounded to
// 1 decimal — refractometer precision doesn't justify more.
export function extractionYield({
  doseG,
  beverageG,
  tdsPct,
}: {
  doseG: number;
  beverageG: number;
  tdsPct: number;
}): number {
  const dose = positive(doseG);
  const beverage = positive(beverageG);
  const tds = positive(tdsPct);
  if (dose === 0 || beverage === 0 || tds === 0) return 0;
  return Math.round(((beverage * tds) / dose) * 10) / 10;
}

// Classify an EY% into its taste band. The boundaries are inclusive of the ideal band:
// exactly 18 or exactly 22 read as "ideal" (the edges of the sweet spot, not past them).
export function band(ey: number): EyBand {
  if (ey < EY_IDEAL_MIN) return "under";
  if (ey > EY_IDEAL_MAX) return "over";
  return "ideal";
}

// Dissolved solids actually in the cup (grams): beverage × TDS. The physical mass the EY%
// represents — nice to surface alongside the percentage. Returns 0 on missing inputs.
export function dissolvedSolidsG(beverageG: number, tdsPct: number): number {
  const beverage = positive(beverageG);
  const tds = positive(tdsPct);
  if (beverage === 0 || tds === 0) return 0;
  return Math.round(((beverage * tds) / 100) * 100) / 100;
}

// Water the spent grounds hold back (grams): water in minus what reached the cup. Only
// meaningful when both were measured; returns 0 if either is missing or the result is ≤ 0.
export function waterRetainedG(waterG: number, beverageG: number): number {
  const water = positive(waterG);
  const beverage = positive(beverageG);
  if (water === 0 || beverage === 0) return 0;
  const retained = water - beverage;
  return retained > 0 ? Math.round(retained * 10) / 10 : 0;
}
