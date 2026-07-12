// Geometry for the five-axis taste radar. Pure math — the drawing (rotated hairline
// Views, no SVG) lives in components/ui/TasteRadar. Axis 0 points straight up and the
// rest follow clockwise, so the pentagon stands on its point like a plotted star.

export type RadarPoint = { x: number; y: number };
// A polygon edge expressed as a rotated rectangle: center, length, and angle — exactly
// what an absolutely-positioned View needs to draw a line between two vertices.
export type RadarEdge = { cx: number; cy: number; length: number; angleDeg: number };

const axisAngle = (i: number, axes: number) => -Math.PI / 2 + (i * 2 * Math.PI) / axes;

// Vertices for one value per axis, each scaled against `max` onto a circle of `radius`
// around (cx, cy). Null/undefined values sit at the center.
export function radarPoints(
  values: Array<number | null | undefined>, max: number, radius: number, cx: number, cy: number
): RadarPoint[] {
  return values.map((v, i) => {
    const r = (Math.min(Math.max(v ?? 0, 0), max) / max) * radius;
    const a = axisAngle(i, values.length);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

// A regular ring (grid pentagon) at `fraction` of the full radius.
export function ringPoints(axes: number, fraction: number, radius: number, cx: number, cy: number): RadarPoint[] {
  return radarPoints(Array(axes).fill(fraction), 1, radius, cx, cy);
}

// Closes the polygon: one edge per consecutive vertex pair, last back to first.
export function polygonEdges(points: RadarPoint[]): RadarEdge[] {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    return {
      cx: (p.x + q.x) / 2,
      cy: (p.y + q.y) / 2,
      length: Math.hypot(dx, dy),
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  });
}
