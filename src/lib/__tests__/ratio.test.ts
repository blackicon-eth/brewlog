import { computeRatio, formatRatio, solveDose, solveWater } from "../ratio";

describe("computeRatio", () => {
  it("divides water by dose", () => {
    expect(computeRatio(15, 250)).toBeCloseTo(16.6667, 3);
  });
  it("returns 0 when dose is 0 (avoid Infinity)", () => {
    expect(computeRatio(0, 250)).toBe(0);
  });
  it("returns 0 for negative dose", () => {
    expect(computeRatio(-5, 250)).toBe(0);
  });
});

describe("formatRatio", () => {
  it("formats as 1:NN.N", () => {
    expect(formatRatio(16.6667)).toBe("1:16.7");
  });
  it("formats whole ratios with one decimal", () => {
    expect(formatRatio(16)).toBe("1:16.0");
  });
});

describe("solveWater", () => {
  it("multiplies dose by ratio and rounds to whole grams", () => {
    expect(solveWater(18, 16.6667)).toBe(300);
  });
  it("rounds espresso-scale doses too", () => {
    expect(solveWater(18, 2)).toBe(36);
  });
  it("returns 0 when dose is 0 (avoid Infinity/NaN)", () => {
    expect(solveWater(0, 16)).toBe(0);
  });
  it("returns 0 when ratio is 0", () => {
    expect(solveWater(18, 0)).toBe(0);
  });
  it("returns 0 for negative inputs", () => {
    expect(solveWater(-18, 16)).toBe(0);
    expect(solveWater(18, -16)).toBe(0);
  });
});

describe("solveDose", () => {
  it("divides water by ratio and rounds to 0.1 g", () => {
    expect(solveDose(300, 16.6667)).toBeCloseTo(18, 1);
  });
  it("handles espresso-scale ratios", () => {
    expect(solveDose(36, 2)).toBe(18);
  });
  it("returns 0 when water is 0 (avoid Infinity/NaN)", () => {
    expect(solveDose(0, 16)).toBe(0);
  });
  it("returns 0 when ratio is 0 (avoid divide-by-zero)", () => {
    expect(solveDose(300, 0)).toBe(0);
  });
  it("returns 0 for negative inputs", () => {
    expect(solveDose(-300, 16)).toBe(0);
    expect(solveDose(300, -16)).toBe(0);
  });
});

describe("round trip", () => {
  it("solveWater then computeRatio recovers the original ratio", () => {
    const water = solveWater(18, 16);
    expect(computeRatio(18, water)).toBeCloseTo(16, 1);
  });
  it("solveDose then computeRatio recovers the original ratio", () => {
    const dose = solveDose(300, 15);
    expect(computeRatio(dose, 300)).toBeCloseTo(15, 1);
  });
});
