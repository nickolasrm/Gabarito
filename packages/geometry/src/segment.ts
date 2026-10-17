import { vec3, type Vec3 } from "./vec3";
import { EPS } from "./tol";

export type Segment = { a: Vec3; b: Vec3 };

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

const length = (s: Segment): number => vec3.dist(s.a, s.b);

const direction = (s: Segment): Vec3 => vec3.normalize(vec3.sub(s.b, s.a));

const midpoint = (s: Segment): Vec3 => vec3.lerp(s.a, s.b, 0.5);

const closestPointToPoint = (s: Segment, p: Vec3): { point: Vec3; t: number } => {
  const ab = vec3.sub(s.b, s.a);
  const denom = vec3.len2(ab);
  const t = denom < EPS.LENGTH * EPS.LENGTH ? 0 : clamp01(vec3.dot(vec3.sub(p, s.a), ab) / denom);
  return { point: vec3.add(s.a, vec3.scale(ab, t)), t };
};

const distanceToPoint = (s: Segment, p: Vec3): number =>
  vec3.dist(p, closestPointToPoint(s, p).point);

const closestPoints = (
  a: Segment,
  b: Segment,
): { onA: Vec3; onB: Vec3; dist: number; tA: number; tB: number } => {
  const d1 = vec3.sub(a.b, a.a);
  const d2 = vec3.sub(b.b, b.a);
  const r = vec3.sub(a.a, b.a);
  const A = vec3.dot(d1, d1);
  const E = vec3.dot(d2, d2);
  const F = vec3.dot(d2, r);
  const B = vec3.dot(d1, d2);
  const C = vec3.dot(d1, r);

  let s: number;
  let t: number;

  if (A <= EPS.LENGTH * EPS.LENGTH && E <= EPS.LENGTH * EPS.LENGTH) {
    s = 0;
    t = 0;
  } else if (A <= EPS.LENGTH * EPS.LENGTH) {
    s = 0;
    t = clamp01(F / E);
  } else if (E <= EPS.LENGTH * EPS.LENGTH) {
    t = 0;
    s = clamp01(-C / A);
  } else {
    const denom = A * E - B * B;
    s = denom > EPS.LENGTH * EPS.LENGTH ? clamp01((B * F - C * E) / denom) : 0;
    t = (B * s + F) / E;
    if (t < 0) {
      t = 0;
      s = clamp01(-C / A);
    } else if (t > 1) {
      t = 1;
      s = clamp01((B - C) / A);
    }
  }

  const onA = vec3.add(a.a, vec3.scale(d1, s));
  const onB = vec3.add(b.a, vec3.scale(d2, t));
  return { onA, onB, dist: vec3.dist(onA, onB), tA: s, tB: t };
};

export const segment = {
  length,
  direction,
  midpoint,
  closestPointToPoint,
  distanceToPoint,
  closestPoints,
};
