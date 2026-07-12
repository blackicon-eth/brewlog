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

// One horizontal slice of a polygon's interior — Views can't fill an arbitrary
// pentagon, so TasteRadar rasterizes the shape into these thin rows (a classic
// scanline fill; handles concave star shapes from uneven taste values too).
export type ScanSegment = { x: number; y: number; width: number; height: number };

export function scanlineFill(points: RadarPoint[], step: number): ScanSegment[] {
  if (points.length < 3) return [];
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const segments: ScanSegment[] = [];
  for (let y = minY + step / 2; y < maxY; y += step) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      // Half-open [min, max) test so a scanline through a vertex counts once, not twice.
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const width = xs[k + 1] - xs[k];
      if (width > 0.5) segments.push({ x: xs[k], y: y - step / 2, width, height: step });
    }
  }
  return segments;
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
