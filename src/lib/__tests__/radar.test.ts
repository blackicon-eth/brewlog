import { polygonEdges, radarPoints, ringPoints } from "../radar";

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("radarPoints", () => {
  it("puts axis 0 straight up at full value", () => {
    const [top] = radarPoints([5], 5, 100, 0, 0);
    expect(close(top.x, 0)).toBe(true);
    expect(close(top.y, -100)).toBe(true);
  });

  it("scales values linearly and clamps out-of-range ones", () => {
    const [half] = radarPoints([2.5], 5, 100, 0, 0);
    expect(close(half.y, -50)).toBe(true);
    const [over] = radarPoints([9], 5, 100, 0, 0);
    expect(close(over.y, -100)).toBe(true);
  });

  it("drops null values to the center", () => {
    const [p] = radarPoints([null], 5, 100, 12, 34);
    expect(close(p.x, 12)).toBe(true);
    expect(close(p.y, 34)).toBe(true);
  });

  it("spreads five axes evenly around the center", () => {
    const pts = radarPoints([5, 5, 5, 5, 5], 5, 100, 0, 0);
    for (const p of pts) expect(close(Math.hypot(p.x, p.y), 100)).toBe(true);
    // distinct directions
    const angles = new Set(pts.map((p) => Math.atan2(p.y, p.x).toFixed(6)));
    expect(angles.size).toBe(5);
  });
});

describe("ringPoints + polygonEdges", () => {
  it("builds a regular pentagon whose edges all match", () => {
    const edges = polygonEdges(ringPoints(5, 1, 100, 0, 0));
    expect(edges).toHaveLength(5);
    const lengths = edges.map((e) => e.length);
    for (const l of lengths) expect(Math.abs(l - lengths[0]) < 1e-9).toBe(true);
    // regular pentagon side for R=100 is 2R·sin(36°) ≈ 117.557
    expect(Math.abs(lengths[0] - 2 * 100 * Math.sin(Math.PI / 5)) < 1e-6).toBe(true);
  });

  it("shrinks rings by fraction", () => {
    const outer = polygonEdges(ringPoints(5, 1, 100, 0, 0))[0].length;
    const inner = polygonEdges(ringPoints(5, 0.4, 100, 0, 0))[0].length;
    expect(Math.abs(inner - outer * 0.4) < 1e-9).toBe(true);
  });
});
