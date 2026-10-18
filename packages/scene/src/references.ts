import {
  EPS,
  V,
  add,
  sub,
  mul,
  dot,
  cross,
  length,
  near,
  unit,
} from "@gabarito/geometry";
import type { Vec3, Segment } from "@gabarito/geometry";
import { edges, position, referenceLines } from "@gabarito/core";
import type { Model, ReferenceLine } from "@gabarito/core";

/** Intersections are virtual snap points and never subdivide model topology. */
export function referenceIntersections(m: Model): Vec3[] {
  const lines = referenceLines(m),
    points = [V()];
  const intersect = (a: ReferenceLine, b: ReferenceLine, segment = false) => {
    const u = unit(a.direction),
      v = unit(b.direction),
      n = cross(u, v),
      size = dot(n, n);
    if (size < EPS * EPS) return;
    const delta = sub(b.origin, a.origin);
    const p = add(a.origin, mul(u, dot(cross(delta, v), n) / size));
    const t = dot(sub(p, b.origin), v);
    if (!near(p, add(b.origin, mul(v, t)))) return;
    if (segment && (t < -EPS || t > length(b.direction) + EPS)) return;
    if (!points.some((other) => near(p, other))) points.push(p);
  };
  lines.forEach((a, i) => {
    lines.slice(i + 1).forEach((b) => intersect(a, b));
    for (const edge of edges(m)) {
      const [p, q] = edge.vertices.map((id) => position(m, id));
      intersect(a, { id: edge.id, origin: p, direction: sub(q, p) }, true);
    }
  });
  return points;
}

/** Clip an infinite line against inward-facing camera frustum halfspaces. */
export function clipReference(
  line: ReferenceLine,
  planes: { normal: Vec3; constant: number }[],
): Segment | null {
  let low = -Infinity,
    high = Infinity;
  for (const p of planes) {
    const offset = dot(p.normal, line.origin) + p.constant,
      slope = dot(p.normal, line.direction);
    if (Math.abs(slope) < 1e-12) {
      if (offset < 0) return null;
      continue;
    }
    const t = -offset / slope;
    if (slope > 0) low = Math.max(low, t);
    else high = Math.min(high, t);
  }
  return low <= high && Number.isFinite(low) && Number.isFinite(high)
    ? [
        add(line.origin, mul(line.direction, low)),
        add(line.origin, mul(line.direction, high)),
      ]
    : null;
}
