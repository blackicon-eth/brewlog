import {
  classify,
  exAxisOf,
  strAxisOf,
  plotPos,
  targetRect,
  DEFAULT_RANGES,
  DEFAULT_POINT,
  TARGET,
} from "../coffeeCompass";

describe("axis classification", () => {
  it("classifies an in-box point as ideal on both axes", () => {
    const v = classify(DEFAULT_POINT.ey, DEFAULT_POINT.tds);
    expect(v.exAxis).toBe("ideal");
    expect(v.strAxis).toBe("ideal");
    expect(v.ideal).toBe(true);
  });

  it("treats the target-band boundaries as inclusive (ideal)", () => {
    expect(exAxisOf(TARGET.ey.min)).toBe("ideal");
    expect(exAxisOf(TARGET.ey.max)).toBe("ideal");
    expect(strAxisOf(TARGET.tds.min)).toBe("ideal");
    expect(strAxisOf(TARGET.tds.max)).toBe("ideal");
  });

  it("EY 15 → under-extracted", () => {
    expect(exAxisOf(15)).toBe("under");
    expect(classify(15, 1.25).exAxis).toBe("under");
  });

  it("EY 24 → over-extracted", () => {
    expect(exAxisOf(24)).toBe("over");
    expect(classify(24, 1.25).exAxis).toBe("over");
  });

  it("TDS 1.1 → weak", () => {
    expect(strAxisOf(1.1)).toBe("weak");
    expect(classify(20, 1.1).strAxis).toBe("weak");
  });

  it("TDS 1.45 → strong", () => {
    expect(strAxisOf(1.45)).toBe("strong");
    expect(classify(20, 1.45).strAxis).toBe("strong");
  });
});

// Verdict copy (title/advice per cell) now lives in the dictionary, resolved via
// `compassCellText` in src/lib/i18n/labels.ts — see src/lib/i18n/__tests__/labels.test.ts
// for coverage that the text itself is right. This lib only needs to classify correctly.
describe("combined verdict cells", () => {
  it("under + weak → not ideal", () => {
    const v = classify(15, 1.1);
    expect(v.exAxis).toBe("under");
    expect(v.strAxis).toBe("weak");
    expect(v.ideal).toBe(false);
  });

  it("over + strong → not ideal", () => {
    const v = classify(24, 1.45);
    expect(v.exAxis).toBe("over");
    expect(v.strAxis).toBe("strong");
    expect(v.ideal).toBe(false);
  });

  it("covers all nine distinct (exAxis, strAxis) cells", () => {
    const eys = [15, 20, 24];
    const tdss = [1.1, 1.25, 1.45];
    const cells = new Set<string>();
    for (const ey of eys) for (const tds of tdss) {
      const v = classify(ey, tds);
      cells.add(`${v.exAxis}-${v.strAxis}`);
    }
    expect(cells.size).toBe(9);
  });
});

describe("plotPos geometry", () => {
  it("maps the range centre to (0.5, 0.5)", () => {
    const midEy = (DEFAULT_RANGES.ey.min + DEFAULT_RANGES.ey.max) / 2;
    const midTds = (DEFAULT_RANGES.tds.min + DEFAULT_RANGES.tds.max) / 2;
    const p = plotPos(midEy, midTds);
    expect(p.x).toBeCloseTo(0.5, 6);
    expect(p.y).toBeCloseTo(0.5, 6);
  });

  it("inverts y — higher TDS sits higher on the chart (smaller y)", () => {
    const low = plotPos(20, DEFAULT_RANGES.tds.min);
    const high = plotPos(20, DEFAULT_RANGES.tds.max);
    expect(high.y).toBeLessThan(low.y);
    expect(high.y).toBeCloseTo(0, 6);
    expect(low.y).toBeCloseTo(1, 6);
  });

  it("grows x left→right with EY", () => {
    expect(plotPos(DEFAULT_RANGES.ey.min, 1.25).x).toBeCloseTo(0, 6);
    expect(plotPos(DEFAULT_RANGES.ey.max, 1.25).x).toBeCloseTo(1, 6);
  });

  it("clamps out-of-range values to [0, 1]", () => {
    const lo = plotPos(-100, -100);
    const hi = plotPos(999, 999);
    expect(lo.x).toBe(0);
    expect(lo.y).toBe(1); // tds below range → bottom of chart
    expect(hi.x).toBe(1);
    expect(hi.y).toBe(0); // tds above range → top of chart
  });
});

describe("targetRect", () => {
  it("produces a rectangle inset within the default plot", () => {
    const r = targetRect();
    expect(r.left).toBeGreaterThan(0);
    expect(r.right).toBeLessThan(1);
    expect(r.top).toBeGreaterThan(0);
    expect(r.bottom).toBeLessThan(1);
    expect(r.right).toBeGreaterThan(r.left);
    expect(r.bottom).toBeGreaterThan(r.top);
  });
});
