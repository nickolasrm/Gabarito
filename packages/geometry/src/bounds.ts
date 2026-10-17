import { vec3, type Vec3 } from "./vec3";
import { EPS } from "./tol";
import type { Segment } from "./segment";

export type Bounds = { min: Vec3; max: Vec3 };

const empty = (): Bounds => ({
  min: { x: Infinity, y: Infinity, z: Infinity },
  max: { x: -Infinity, y: -Infinity, z: -Infinity },
});

const isEmpty = (b: Bounds): boolean =>
  b.min.x > b.max.x || b.min.y > b.max.y || b.min.z > b.max.z;

const expand = (b: Bounds, p: Vec3): Bounds => ({
  min: { x: Math.min(b.min.x, p.x), y: Math.min(b.min.y, p.y), z: Math.min(b.min.z, p.z) },
  max: { x: Math.max(b.max.x, p.x), y: Math.max(b.max.y, p.y), z: Math.max(b.max.z, p.z) },
});

const fromPoints = (points: Vec3[]): Bounds | null => {
  if (points.length === 0) return null;
  let b = empty();
  for (const p of points) b = expand(b, p);
  return b;
};

const fromSegments = (segments: Segment[]): Bounds | null => {
  if (segments.length === 0) return null;
  let b = empty();
  for (const s of segments) {
    b = expand(b, s.a);
    b = expand(b, s.b);
  }
  return b;
};

const union = (a: Bounds, b: Bounds): Bounds => {
  if (isEmpty(a)) return { min: vec3.clone(b.min), max: vec3.clone(b.max) };
  if (isEmpty(b)) return { min: vec3.clone(a.min), max: vec3.clone(a.max) };
  return {
    min: {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y),
      z: Math.min(a.min.z, b.min.z),
    },
    max: {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y),
      z: Math.max(a.max.z, b.max.z),
    },
  };
};

const contains = (b: Bounds, p: Vec3, eps: number = EPS.LENGTH): boolean => {
  if (isEmpty(b)) return false;
  return (
    p.x >= b.min.x - eps &&
    p.x <= b.max.x + eps &&
    p.y >= b.min.y - eps &&
    p.y <= b.max.y + eps &&
    p.z >= b.min.z - eps &&
    p.z <= b.max.z + eps
  );
};

const intersects = (a: Bounds, b: Bounds): boolean => {
  if (isEmpty(a) || isEmpty(b)) return false;
  const eps = EPS.LENGTH;
  return (
    a.min.x <= b.max.x + eps &&
    a.max.x >= b.min.x - eps &&
    a.min.y <= b.max.y + eps &&
    a.max.y >= b.min.y - eps &&
    a.min.z <= b.max.z + eps &&
    a.max.z >= b.min.z - eps
  );
};

const center = (b: Bounds): Vec3 => vec3.scale(vec3.add(b.min, b.max), 0.5);

const size = (b: Bounds): Vec3 => vec3.sub(b.max, b.min);

const diagonal = (b: Bounds): number => (isEmpty(b) ? 0 : vec3.dist(b.min, b.max));

export const bounds = {
  empty,
  fromPoints,
  fromSegments,
  expand,
  union,
  contains,
  intersects,
  center,
  size,
  diagonal,
  isEmpty,
};
