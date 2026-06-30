import { computeRatio, formatRatio } from "../ratio";

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
