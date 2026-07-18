import {
  extractionYield,
  band,
  dissolvedSolidsG,
  waterRetainedG,
  EY_IDEAL_MIN,
  EY_IDEAL_MAX,
} from "../extraction";

describe("extractionYield", () => {
  it("matches the verified worked example: 36 g × 10% / 18 g = 20%", () => {
    expect(extractionYield({ doseG: 18, beverageG: 36, tdsPct: 10 })).toBe(20);
  });

  it("computes a typical filter brew (300 g bev × 1.35% / 18 g ≈ 22.5%)", () => {
    expect(extractionYield({ doseG: 18, beverageG: 300, tdsPct: 1.35 })).toBe(22.5);
  });

  it("rounds to one decimal", () => {
    // 250 × 1.3 / 15 = 21.666… -> 21.7
    expect(extractionYield({ doseG: 15, beverageG: 250, tdsPct: 1.3 })).toBe(21.7);
  });

  it("does NOT use the refuted water-weight shortcut", () => {
    // The refuted formula TDS×water/dose would give 1.35×320/18 = 24.0. The correct one
    // uses beverage weight (300), giving 22.5. They must differ, and we return the correct.
    const correct = extractionYield({ doseG: 18, beverageG: 300, tdsPct: 1.35 });
    const refuted = (1.35 * 320) / 18;
    expect(correct).toBe(22.5);
    expect(correct).not.toBeCloseTo(refuted, 1);
  });

  it("guards divide-by-zero (dose = 0) -> 0", () => {
    expect(extractionYield({ doseG: 0, beverageG: 36, tdsPct: 10 })).toBe(0);
  });

  it("guards a negative dose -> 0", () => {
    expect(extractionYield({ doseG: -18, beverageG: 36, tdsPct: 10 })).toBe(0);
  });

  it("returns 0 (not NaN) when TDS is missing", () => {
    expect(extractionYield({ doseG: 18, beverageG: 36, tdsPct: 0 })).toBe(0);
  });

  it("returns 0 (not NaN) when beverage weight is missing", () => {
    const ey = extractionYield({ doseG: 18, beverageG: 0, tdsPct: 10 });
    expect(ey).toBe(0);
    expect(Number.isNaN(ey)).toBe(false);
  });

  it("returns 0 for NaN inputs", () => {
    expect(extractionYield({ doseG: NaN, beverageG: 36, tdsPct: 10 })).toBe(0);
  });
});

describe("band", () => {
  it("classifies below the ideal band as under-extracted", () => {
    expect(band(17.9)).toBe("under");
    expect(band(12)).toBe("under");
  });

  it("treats the lower boundary (18) as ideal", () => {
    expect(band(EY_IDEAL_MIN)).toBe("ideal");
    expect(band(18)).toBe("ideal");
  });

  it("classifies inside the band as ideal", () => {
    expect(band(20)).toBe("ideal");
  });

  it("treats the upper boundary (22) as ideal", () => {
    expect(band(EY_IDEAL_MAX)).toBe("ideal");
    expect(band(22)).toBe("ideal");
  });

  it("classifies above the ideal band as over-extracted", () => {
    expect(band(22.1)).toBe("over");
    expect(band(26)).toBe("over");
  });
});

describe("dissolvedSolidsG", () => {
  it("computes grams of dissolved solids from beverage × TDS", () => {
    // 36 g × 10% = 3.6 g
    expect(dissolvedSolidsG(36, 10)).toBe(3.6);
  });

  it("computes a filter-strength example", () => {
    // 300 g × 1.35% = 4.05 g
    expect(dissolvedSolidsG(300, 1.35)).toBe(4.05);
  });

  it("guards missing inputs -> 0", () => {
    expect(dissolvedSolidsG(0, 10)).toBe(0);
    expect(dissolvedSolidsG(36, 0)).toBe(0);
  });
});

describe("waterRetainedG", () => {
  it("computes water held back by grounds (water − beverage)", () => {
    expect(waterRetainedG(300, 264)).toBe(36);
  });

  it("returns 0 when beverage exceeds water (nonsensical) or inputs missing", () => {
    expect(waterRetainedG(264, 300)).toBe(0);
    expect(waterRetainedG(0, 264)).toBe(0);
    expect(waterRetainedG(300, 0)).toBe(0);
  });
});
