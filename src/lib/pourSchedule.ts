// Pour-over schedule builder — the deterministic math behind the Brew Timer tool.
//
// Model (see TOOLS.md, tool 2): a bloom pour at t = 0, then a series of evenly-spaced main
// pours, each with a *cumulative* water-weight target the brewer pours up to. Everything is
// derived from a dose, a ratio (or total water), a bloom multiplier, a main-pour count and a
// pour interval — no time-of-day, no randomness. Given the same inputs it always returns the
// same schedule, so it's trivially unit-testable and the running timer stays a thin view over it.

// Default bloom length (when the bloom "ends" and the first main pour begins). A ~45 s
// bloom is the pour-over convention (Hoffmann et al.); callers can override per brew via
// `bloomTimeS`. The main pours cascade from bloom end at `pourIntervalS`.
export const BLOOM_END_S = 45;

export type PourStep = {
  // Elapsed seconds from timer start when this step's pour begins.
  atSeconds: number;
  // What kind of step this is — the UI layer resolves this (+ pourNumber) to a localized
  // instruction label, e.g. "Bloom" / "Pour 1". Kept as an id here so this stays pure/locale-free.
  kind: "bloom" | "pour";
  // 1-based main-pour number. Present only when kind === "pour".
  pourNumber?: number;
  // Cumulative water on the scale the brewer should reach by the END of this pour (grams).
  cumulativeTargetG: number;
};

export type PourSchedule = {
  totalWater: number; // doseG × ratio
  bloomWater: number; // doseG × bloomMultiplier (the t=0 target)
  mainWater: number; // totalWater − bloomWater (split across the main pours)
  perPour: number; // mainWater / mainPours (added each main pour)
  steps: PourStep[]; // step 0 = bloom, then one per main pour
};

export type PourScheduleInput = {
  doseG: number;
  // The X in a 1:X brew ratio (e.g. 16.67). Ignored if `totalWaterG` is given.
  ratio?: number;
  // Optional explicit total water (grams). Takes precedence over `ratio` when > 0 — lets a
  // brewer who thinks in "500 g out" drive the schedule directly.
  totalWaterG?: number;
  bloomMultiplier: number; // bloom target = dose × this (typically 2–3)
  // Bloom length in seconds — when the first main pour begins. Defaults to BLOOM_END_S.
  bloomTimeS?: number;
  mainPours: number; // number of main pours after the bloom (≥ 1)
  pourIntervalS: number; // seconds between the START of consecutive main pours
};

export class PourScheduleError extends Error {}

// Rounds to whole grams — brew water is read off a gram scale, so fractional targets would
// just be noise on the timer. Bloom/total are already whole in practice; this keeps the
// per-pour cumulative targets clean too.
const roundG = (g: number) => Math.round(g);

// Builds the full pour schedule, or throws `PourScheduleError` on invalid input. Validation
// mirrors the spec: every input must be finite and > 0, at least one main pour, and the bloom
// must be a strict prefix of the total (bloomWater < totalWater) so there's water left to pour.
export function buildPourSchedule(input: PourScheduleInput): PourSchedule {
  const { doseG, ratio, totalWaterG, bloomMultiplier, bloomTimeS = BLOOM_END_S, mainPours, pourIntervalS } = input;

  const positives: [string, number | undefined][] = [
    ["doseG", doseG],
    ["bloomMultiplier", bloomMultiplier],
    ["bloomTimeS", bloomTimeS],
    ["pourIntervalS", pourIntervalS],
  ];
  for (const [name, v] of positives) {
    if (!Number.isFinite(v) || (v as number) <= 0) {
      throw new PourScheduleError(`${name} must be a positive number`);
    }
  }
  if (!Number.isInteger(mainPours) || mainPours < 1) {
    throw new PourScheduleError("mainPours must be an integer ≥ 1");
  }

  // Total water: explicit weight wins, otherwise derive from the ratio.
  let totalWater: number;
  if (Number.isFinite(totalWaterG) && (totalWaterG as number) > 0) {
    totalWater = totalWaterG as number;
  } else if (Number.isFinite(ratio) && (ratio as number) > 0) {
    totalWater = doseG * (ratio as number);
  } else {
    throw new PourScheduleError("provide a positive ratio or totalWaterG");
  }

  const bloomWater = doseG * bloomMultiplier;
  if (bloomWater >= totalWater) {
    throw new PourScheduleError("bloomWater must be less than totalWater");
  }

  const mainWater = totalWater - bloomWater;
  const perPour = mainWater / mainPours;

  const steps: PourStep[] = [
    { atSeconds: 0, kind: "bloom", cumulativeTargetG: roundG(bloomWater) },
  ];
  for (let k = 1; k <= mainPours; k++) {
    steps.push({
      atSeconds: bloomTimeS + (k - 1) * pourIntervalS,
      kind: "pour",
      pourNumber: k,
      // Cumulative target after bloom + k main pours. The last pour lands exactly on
      // totalWater by construction (bloomWater + perPour × mainPours = totalWater), so we
      // pin k === mainPours to the rounded total and avoid float drift on the finish target.
      cumulativeTargetG:
        k === mainPours ? roundG(totalWater) : roundG(bloomWater + perPour * k),
    });
  }

  return {
    totalWater: roundG(totalWater),
    bloomWater: roundG(bloomWater),
    mainWater: roundG(mainWater),
    perPour,
    steps,
  };
}

// Rough drawdown-finish estimate for the setup preview: last pour start + one interval of
// pouring + ~30 s drawdown. Used only for the "finish by ~m:ss" hint, not the live timer.
export function estimateFinishSeconds(schedule: PourSchedule, pourIntervalS: number): number {
  const lastPour = schedule.steps[schedule.steps.length - 1];
  return lastPour.atSeconds + pourIntervalS + 30;
}
