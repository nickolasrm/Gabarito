import { vec3, type Vec3 } from "./vec3";
import { EPS } from "./tol";
import { plane as planeOps, type Plane } from "./plane";
import type { Segment } from "./segment";

export type Ray = { origin: Vec3; direction: Vec3 };

const of = (origin: Vec3, direction: Vec3): Ray => ({
  origin: vec3.clone(origin),
  direction: vec3.normalize(direction),
});

const at = (r: Ray, t: number): Vec3 => vec3.add(r.origin, vec3.scale(r.direction, t));

const intersectPlane = (r: Ray, p: Plane): Vec3 | null => {
  const denom = vec3.dot(p.normal, r.direction);
  if (Math.abs(denom) < EPS.PARALLEL) return null;
  const t = -planeOps.distanceToPoint(p, r.origin) / denom;
  if (t < -EPS.LENGTH) return null;
  return at(r, t < 0 ? 0 : t);
};

const closestPointsToSegment = (
  r: Ray,
  s: Segment,
): { onRay: Vec3; onSegment: Vec3; dist: number; tRay: number; tSeg: number } => {
  const d1 = r.direction;
  const d2 = vec3.sub(s.b, s.a);
  const r0 = vec3.sub(r.origin, s.a);
  const A = vec3.dot(d1, d1);
  const E = vec3.dot(d2, d2);
  const B = vec3.dot(d1, d2);
  const C = vec3.dot(d1, r0);
  const F = vec3.dot(d2, r0);

  if (A <= EPS.LENGTH * EPS.LENGTH) {
    // Degenerate ray: its origin is the only candidate point.
    const t = E <= EPS.LENGTH * EPS.LENGTH ? 0 : F / E < 0 ? 0 : F / E > 1 ? 1 : F / E;
    const onSegment = vec3.add(s.a, vec3.scale(d2, t));
    return { onRay: vec3.clone(r.origin), onSegment, dist: vec3.dist(r.origin, onSegment), tRay: 0, tSeg: t };
  }

  let tSeg: number;
  if (E <= EPS.LENGTH * EPS.LENGTH) {
    tSeg = 0;
  } else {
    const denom = A * E - B * B;
    tSeg = denom > EPS.LENGTH * EPS.LENGTH ? (A * F - B * C) / denom : 0;
    tSeg = tSeg < 0 ? 0 : tSeg > 1 ? 1 : tSeg;
  }

  let tRay = (B * tSeg - C) / A;
  if (tRay < 0) {
    tRay = 0;
    tSeg = E <= EPS.LENGTH * EPS.LENGTH ? 0 : (F / E < 0 ? 0 : F / E > 1 ? 1 : F / E);
  }

  const onRay = at(r, tRay);
  const onSegment = vec3.add(s.a, vec3.scale(d2, tSeg));
  return { onRay, onSegment, dist: vec3.dist(onRay, onSegment), tRay, tSeg };
};

const intersectSegment = (r: Ray, s: Segment): Vec3 | null => {
  const cp = closestPointsToSegment(r, s);
  if (
    cp.dist <= EPS.MERGE &&
    cp.tRay >= -EPS.LENGTH &&
    cp.tSeg >= -EPS.LENGTH &&
    cp.tSeg <= 1 + EPS.LENGTH
  ) {
    return cp.onRay;
  }
  return null;
};

export const ray = { of, at, intersectPlane, intersectSegment, closestPointsToSegment };
