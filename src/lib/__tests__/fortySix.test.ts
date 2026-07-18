import {
  buildFortySix,
  clampPhase60Pours,
  DEFAULT_PHASE60_POURS,
  DEFAULT_WATER_G,
  MAX_PHASE60_POURS,
  MIN_PHASE60_POURS,
} from "../fortySix";

describe("buildFortySix", () => {
  it("computes the canonical default recipe: 300g total", () => {
    const recipe = buildFortySix({ totalWaterG: DEFAULT_WATER_G });
    expect(recipe.totalWaterG).toBe(300);
    expect(recipe.phase40G).toBe(120);
    expect(recipe.phase60G).toBe(180);
  });

  it("splits phase 40 into exactly 2 pours and phase 60 into N pours (default 3) -> 5 pours total", () => {
    const recipe = buildFortySix({ totalWaterG: DEFAULT_WATER_G });
    expect(recipe.pours).toHaveLength(5);
    expect(recipe.pours.filter((p) => p.phase === "taste")).toHaveLength(2);
    expect(recipe.pours.filter((p) => p.phase === "strength")).toHaveLength(3);
    expect(recipe.phase60Pours).toBe(DEFAULT_PHASE60_POURS);
  });

  it("ends the cumulative total exactly at totalWaterG", () => {
    const recipe = buildFortySix({ totalWaterG: DEFAULT_WATER_G });
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(recipe.totalWaterG);
  });

  it("evenly splits the default 40% phase (balanced bias)", () => {
    const recipe = buildFortySix({ totalWaterG: DEFAULT_WATER_G });
    const [p1, p2] = recipe.pours;
    expect(p1.pourG).toBe(60);
    expect(p2.pourG).toBe(60);
    expect(p1.cumulativeG).toBe(60);
    expect(p2.cumulativeG).toBe(120);
  });

  it("evenly splits the 60% phase across N pours", () => {
    const recipe = buildFortySix({ totalWaterG: DEFAULT_WATER_G, phase60Pours: 3 });
    const strengthPours = recipe.pours.filter((p) => p.phase === "strength");
    expect(strengthPours.map((p) => p.pourG)).toEqual([60, 60, 60]);
  });

  it("assigns cumulative timestamps ~45s apart starting at 0:00", () => {
    const recipe = buildFortySix({ totalWaterG: DEFAULT_WATER_G });
    expect(recipe.pours.map((p) => p.atSeconds)).toEqual([0, 45, 90, 135, 180]);
    expect(recipe.totalSeconds).toBe(180);
  });

  it("supports a smaller phase-60 pour count (lighter cup) with exact rounding", () => {
    const recipe = buildFortySix({ totalWaterG: 300, phase60Pours: 2 });
    expect(recipe.pours).toHaveLength(4);
    const strengthPours = recipe.pours.filter((p) => p.phase === "strength");
    expect(strengthPours.reduce((sum, p) => sum + p.pourG, 0)).toBe(180);
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(300);
  });

  it("supports a single phase-60 pour (the lightest cup): one pour carrying the whole 60%", () => {
    const recipe = buildFortySix({ totalWaterG: 300, phase60Pours: 1 });
    expect(recipe.pours).toHaveLength(3);
    const strengthPours = recipe.pours.filter((p) => p.phase === "strength");
    expect(strengthPours.map((p) => p.pourG)).toEqual([180]);
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(300);
    expect(recipe.totalSeconds).toBe(90);
  });

  it("supports a larger phase-60 pour count (stronger cup) with exact rounding", () => {
    const recipe = buildFortySix({ totalWaterG: 300, phase60Pours: 4 });
    expect(recipe.pours).toHaveLength(6);
    const strengthPours = recipe.pours.filter((p) => p.phase === "strength");
    expect(strengthPours.reduce((sum, p) => sum + p.pourG, 0)).toBe(180);
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(300);
  });

  it("handles rounding remainders so pours always sum exactly to the total (odd totalWaterG)", () => {
    // 233g total is not evenly divisible across 3 phase-60 pours.
    const recipe = buildFortySix({ totalWaterG: 233, phase60Pours: 3 });
    const sum = recipe.pours.reduce((s, p) => s + p.pourG, 0);
    expect(sum).toBe(recipe.totalWaterG);
    expect(recipe.pours[recipe.pours.length - 1].cumulativeG).toBe(recipe.totalWaterG);
  });

  it("rounds fractional water input to whole grams before splitting", () => {
    const recipe = buildFortySix({ totalWaterG: 232.9 });
    expect(recipe.totalWaterG).toBe(233);
    for (const p of recipe.pours) {
      expect(Number.isInteger(p.pourG)).toBe(true);
      expect(Number.isInteger(p.cumulativeG)).toBe(true);
    }
  });

  it("biases the first pour smaller for 'sweeter'", () => {
    const recipe = buildFortySix({ totalWaterG: DEFAULT_WATER_G, firstPourBias: "sweeter" });
    const [p1, p2] = recipe.pours;
    expect(p1.pourG).toBeLessThan(p2.pourG);
    expect(p1.pourG + p2.pourG).toBe(recipe.phase40G);
  });

  it("biases the first pour larger for 'brighter'", () => {
    const recipe = buildFortySix({ totalWaterG: DEFAULT_WATER_G, firstPourBias: "brighter" });
    const [p1, p2] = recipe.pours;
    expect(p1.pourG).toBeGreaterThan(p2.pourG);
    expect(p1.pourG + p2.pourG).toBe(recipe.phase40G);
  });

  it("returns an empty pour list for zero water", () => {
    const recipe = buildFortySix({ totalWaterG: 0 });
    expect(recipe.pours).toEqual([]);
    expect(recipe.totalWaterG).toBe(0);
  });

  it("returns an empty pour list for negative water", () => {
    expect(buildFortySix({ totalWaterG: -5 }).pours).toEqual([]);
  });

  it("returns an empty pour list for NaN water (unparseable input)", () => {
    expect(buildFortySix({ totalWaterG: NaN }).pours).toEqual([]);
  });
});

describe("clampPhase60Pours", () => {
  it("passes values already in range through untouched", () => {
    expect(clampPhase60Pours(3)).toBe(3);
  });
  it("passes the new minimum of 1 through untouched", () => {
    expect(clampPhase60Pours(1)).toBe(1);
  });
  it("clamps below the minimum", () => {
    expect(clampPhase60Pours(0)).toBe(MIN_PHASE60_POURS);
    expect(clampPhase60Pours(-3)).toBe(MIN_PHASE60_POURS);
  });
  it("clamps above the maximum", () => {
    expect(clampPhase60Pours(10)).toBe(MAX_PHASE60_POURS);
  });
  it("rounds fractional values", () => {
    expect(clampPhase60Pours(2.6)).toBe(3);
  });
});
