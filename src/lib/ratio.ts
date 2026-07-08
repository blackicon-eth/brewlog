export function computeRatio(doseG: number, waterG: number): number {
  if (!doseG || doseG <= 0) return 0;
  return waterG / doseG;
}

export function formatRatio(ratio: number): string {
  return `1:${ratio.toFixed(1)}`;
}

// --- Brew Ratio / Water Calculator -----------------------------------------------------
// Lock any two of {dose, water, ratio}; solve the third. All three share the identity
// ratio = waterG / doseG. Guards divide-by-zero and non-finite inputs by returning 0
// rather than NaN/Infinity, so the UI never has to special-case a broken readout.

// waterG = doseG × ratio — round to whole grams (brew water is measured on a gram scale).
export function solveWater(doseG: number, ratio: number): number {
  if (!doseG || doseG <= 0 || !ratio || ratio <= 0) return 0;
  return Math.round(doseG * ratio);
}

// doseG = waterG / ratio — round to 0.1 g (dose is typically weighed to a tenth of a gram).
export function solveDose(waterG: number, ratio: number): number {
  if (!waterG || waterG <= 0 || !ratio || ratio <= 0) return 0;
  return Math.round((waterG / ratio) * 10) / 10;
}
