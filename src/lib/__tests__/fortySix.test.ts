import {
  buildFortySix,
  clampPhase60Pours,
  DEFAULT_DOSE_G,
  DEFAULT_PHASE60_POURS,
  DEFAULT_RATIO,
  MAX_PHASE60_POURS,
  MIN_PHASE60_POURS,
} from "../fortySix";

describe("buildFortySix", () => {
  it("computes the canonical default recipe: 20g / 1:15 -> 300g total", () => {
    const recipe = buildFortySix({ doseG: DEFAULT_DOSE_G, ratio: DEFAULT_RATIO });
    expect(recipe.totalWaterG).toBe(300);
    expect(recipe.phase40G).toBe(120);
    expect(recipe.phase60G).toBe(180);
  });

  it("splits phase 40 into exactly 2 pours and phase 60 into N pours (default 3) -> 5 pours total", () => {
    const recipe = buildFortySix({ doseG: DEFAULT_DOSE_G, ratio: DEFAULT_RATIO });
    expect(recipe.pours).toHaveLength(5);
    expect(recipe.pours.filter((p) => p.phase === "taste")).toHaveLength(2);
    expect(recipe.pours.filter((p) => p.phase === "strength")).toHaveLength(3);
    expect(recipe.phase60Pours).toBe(DEFAULT_PHASE60_POURS);
  });

  it("ends the cumulative total exactly at totalWaterG", () => {
    const recipe = buildFortySix({ doseG: DEFAULT_DOSE_G, ratio: DEFAULT_RATIO });
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(recipe.totalWaterG);
  });

  it("evenly splits the default 40% phase (balanced bias)", () => {
    const recipe = buildFortySix({ doseG: DEFAULT_DOSE_G, ratio: DEFAULT_RATIO });
    const [p1, p2] = recipe.pours;
    expect(p1.pourG).toBe(60);
    expect(p2.pourG).toBe(60);
    expect(p1.cumulativeG).toBe(60);
    expect(p2.cumulativeG).toBe(120);
  });

  it("evenly splits the 60% phase across N pours", () => {
    const recipe = buildFortySix({ doseG: DEFAULT_DOSE_G, ratio: DEFAULT_RATIO, phase60Pours: 3 });
    const strengthPours = recipe.pours.filter((p) => p.phase === "strength");
    expect(strengthPours.map((p) => p.pourG)).toEqual([60, 60, 60]);
  });

  it("assigns cumulative timestamps ~45s apart starting at 0:00", () => {
    const recipe = buildFortySix({ doseG: DEFAULT_DOSE_G, ratio: DEFAULT_RATIO });
    expect(recipe.pours.map((p) => p.atSeconds)).toEqual([0, 45, 90, 135, 180]);
    expect(recipe.totalSeconds).toBe(180);
  });

  it("supports a smaller phase-60 pour count (stronger cup) with exact rounding", () => {
    const recipe = buildFortySix({ doseG: 20, ratio: 15, phase60Pours: 2 });
    expect(recipe.pours).toHaveLength(4);
    const strengthPours = recipe.pours.filter((p) => p.phase === "strength");
    expect(strengthPours.reduce((sum, p) => sum + p.pourG, 0)).toBe(180);
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(300);
  });

  it("supports a larger phase-60 pour count (lighter cup) with exact rounding", () => {
    const recipe = buildFortySix({ doseG: 20, ratio: 15, phase60Pours: 4 });
    expect(recipe.pours).toHaveLength(6);
    const strengthPours = recipe.pours.filter((p) => p.phase === "strength");
    expect(strengthPours.reduce((sum, p) => sum + p.pourG, 0)).toBe(180);
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(300);
  });

  it("handles rounding remainders so pours always sum exactly to the total (odd totalWaterG)", () => {
    // 17g x 1:13.7 -> 232.9 -> rounds to 233g total, not evenly divisible by 3 phase60 pours.
    const recipe = buildFortySix({ doseG: 17, ratio: 13.7, phase60Pours: 3 });
    const sum = recipe.pours.reduce((s, p) => s + p.pourG, 0);
    expect(sum).toBe(recipe.totalWaterG);
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(recipe.totalWaterG);
  });

  it("biases the first pour smaller for 'sweeter'", () => {
    const recipe = buildFortySix({ doseG: DEFAULT_DOSE_G, ratio: DEFAULT_RATIO, firstPourBias: "sweeter" });
    const [p1, p2] = recipe.pours;
    expect(p1.pourG).toBeLessThan(p2.pourG);
    expect(p1.pourG + p2.pourG).toBe(recipe.phase40G);
  });

  it("biases the first pour larger for 'brighter'", () => {
    const recipe = buildFortySix({ doseG: DEFAULT_DOSE_G, ratio: DEFAULT_RATIO, firstPourBias: "brighter" });
    const [p1, p2] = recipe.pours;
    expect(p1.pourG).toBeGreaterThan(p2.pourG);
    expect(p1.pourG + p2.pourG).toBe(recipe.phase40G);
  });

  it("rounds all pour weights to whole grams", () => {
    const recipe = buildFortySix({ doseG: 18.5, ratio: 16.3 });
    for (const p of recipe.pours) {
      expect(Number.isInteger(p.pourG)).toBe(true);
      expect(Number.isInteger(p.cumulativeG)).toBe(true);
    }
  });

  it("returns an empty pour list for a zero dose", () => {
    const recipe = buildFortySix({ doseG: 0, ratio: 15 });
    expect(recipe.pours).toEqual([]);
    expect(recipe.totalWaterG).toBe(0);
  });

  it("returns an empty pour list for a negative dose", () => {
    const recipe = buildFortySix({ doseG: -5, ratio: 15 });
    expect(recipe.pours).toEqual([]);
  });

  it("returns an empty pour list for a zero or negative ratio", () => {
    expect(buildFortySix({ doseG: 20, ratio: 0 }).pours).toEqual([]);
    expect(buildFortySix({ doseG: 20, ratio: -1 }).pours).toEqual([]);
  });
});

describe("clampPhase60Pours", () => {
  it("passes values already in range through untouched", () => {
    expect(clampPhase60Pours(3)).toBe(3);
  });
  it("clamps below the minimum", () => {
    expect(clampPhase60Pours(1)).toBe(MIN_PHASE60_POURS);
    expect(clampPhase60Pours(0)).toBe(MIN_PHASE60_POURS);
  });
  it("clamps above the maximum", () => {
    expect(clampPhase60Pours(10)).toBe(MAX_PHASE60_POURS);
  });
  it("rounds fractional values", () => {
    expect(clampPhase60Pours(2.6)).toBe(3);
  });
});
