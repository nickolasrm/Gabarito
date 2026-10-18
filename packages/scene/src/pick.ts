import { referenceIntersections } from "./references";
import {
  EPS,
  add,
  sub,
  mul,
  dot,
  cross,
  length,
  unit,
  triangulate,
  axisPoint,
} from "@gabarito/geometry";
import type { Vec3, Ray } from "@gabarito/geometry";
import {
  vertices,
  edges,
  faces,
  position,
  surface,
  referenceLines,
} from "@gabarito/core";
import type { Model } from "@gabarito/core";
export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
  visible: boolean;
}
export interface PickView {
  origin: Vec3;
  project(p: Vec3): ScreenPoint;
  ray(x: number, y: number): Ray;
}
export interface Hit {
  id: string;
  kind: "vertex" | "edge" | "face" | "guide";
  snap?: "midpoint" | "intersection" | "origin";
  point: Vec3;
}
function triangleHit(ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
  const e1 = sub(b, a),
    e2 = sub(c, a),
    h = cross(ray.direction, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-10) return null;
  const s = sub(ray.origin, a),
    u = dot(s, h) / det,
    q = cross(s, e1),
    v = dot(ray.direction, q) / det;
  if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) return null;
  const t = dot(e2, q) / det;
  return t > EPS ? t : null;
}
export function faceHit(
  m: Model,
  ray: Ray,
): (Hit & { distance: number }) | null {
  let best: (Hit & { distance: number }) | null = null;
  for (const f of faces(m)) {
    const mesh = triangulate(surface(m, f));
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const [a, b, c] = mesh.triangles
          .slice(i, i + 3)
          .map((k) => mesh.points[k]),
        t = triangleHit(ray, a, b, c);
      if (t !== null && (!best || t < best.distance))
        best = {
          id: f.id,
          kind: "face",
          point: add(ray.origin, mul(ray.direction, t)),
          distance: t,
        };
    }
  }
  return best;
}
export function visible(m: Model, view: PickView, p: Vec3): boolean {
  if (!view.project(p).visible) return false;
  const offset = sub(p, view.origin),
    distance = length(offset);
  const obstruction = faceHit(m, {
    origin: view.origin,
    direction: unit(offset),
  });
  return !obstruction || obstruction.distance >= distance - EPS * 10;
}
export function pick(
  m: Model,
  view: PickView,
  x: number,
  y: number,
  tolerance = 8,
): Hit | null {
  const candidates: {
    hit: Hit;
    pixels: number;
    priority: number;
    depth: number;
  }[] = [];
  for (const v of vertices(m)) {
    const p = view.project(v.position),
      pixels = Math.hypot(p.x - x, p.y - y);
    if (pixels <= tolerance && visible(m, view, v.position))
      candidates.push({
        hit: { id: v.id, kind: "vertex", point: v.position },
        pixels,
        priority: 0,
        depth: p.depth,
      });
  }
  for (const e of edges(m)) {
    const a = position(m, e.vertices[0]),
      b = position(m, e.vertices[1]),
      pa = view.project(a),
      pb = view.project(b);
    // Segments crossing the near plane are not snap targets; never project their hidden endpoint.
    if (!pa.visible || !pb.visible) continue;
    const midpoint = mul(add(a, b), 0.5),
      pm = view.project(midpoint),
      midpointPixels = Math.hypot(pm.x - x, pm.y - y);
    if (midpointPixels <= tolerance && visible(m, view, midpoint))
      candidates.push({
        hit: { id: e.id, kind: "edge", point: midpoint, snap: "midpoint" },
        pixels: midpointPixels,
        priority: 1,
        depth: pm.depth,
      });
    const dx = pb.x - pa.x,
      dy = pb.y - pa.y,
      size = dx * dx + dy * dy;
    const alpha =
      size > 0
        ? Math.max(0, Math.min(1, ((x - pa.x) * dx + (y - pa.y) * dy) / size))
        : 0;
    const pixels = Math.hypot(pa.x + alpha * dx - x, pa.y + alpha * dy - y);
    const t = (alpha * pa.depth) / ((1 - alpha) * pb.depth + alpha * pa.depth);
    const point = add(a, mul(sub(b, a), t));
    if (pixels <= tolerance && visible(m, view, point))
      candidates.push({
        hit: { id: e.id, kind: "edge", point },
        pixels,
        priority: 2,
        depth: view.project(point).depth,
      });
  }
  for (const [i, point] of referenceIntersections(m).entries()) {
    const p = view.project(point),
      pixels = Math.hypot(p.x - x, p.y - y);
    if (pixels <= tolerance && visible(m, view, point))
      candidates.push({
        hit: {
          id: i === 0 ? "world:origin" : `intersection:${i}`,
          kind: "vertex",
          point,
          snap: i === 0 ? "origin" : "intersection",
        },
        pixels,
        priority: 1,
        depth: p.depth,
      });
  }
  for (const line of referenceLines(m)) {
    const point = axisPoint(view.ray(x, y), line.origin, line.direction),
      p = view.project(point),
      pixels = Math.hypot(p.x - x, p.y - y);
    if (pixels <= tolerance && visible(m, view, point))
      candidates.push({
        hit: { id: line.id, kind: "guide", point },
        pixels,
        priority: 3,
        depth: p.depth,
      });
  }
  candidates.sort(
    (a, b) =>
      a.priority - b.priority || a.pixels - b.pixels || a.depth - b.depth,
  );
  return candidates[0]?.hit ?? faceHit(m, view.ray(x, y));
}
