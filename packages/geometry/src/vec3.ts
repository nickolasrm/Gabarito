import { EPS } from "./tol";

export type Vec3 = { x: number; y: number; z: number };

const of = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const mul = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x * b.x, y: a.y * b.y, z: a.z * b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const len2 = (a: Vec3): number => dot(a, a);
const len = (a: Vec3): number => Math.sqrt(len2(a));

const normalize = (a: Vec3): Vec3 => {
  const l = len(a);
  return l < EPS.LENGTH ? of(0, 0, 0) : scale(a, 1 / l);
};

const neg = (a: Vec3): Vec3 => ({ x: 0 - a.x, y: 0 - a.y, z: 0 - a.z });

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));

const equals = (a: Vec3, b: Vec3, eps: number = EPS.MERGE): boolean =>
  Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps && Math.abs(a.z - b.z) <= eps;

const isZero = (a: Vec3, eps: number = EPS.LENGTH): boolean => len2(a) <= eps * eps;

const clone = (a: Vec3): Vec3 => of(a.x, a.y, a.z);

const toArray = (a: Vec3): [number, number, number] => [a.x, a.y, a.z];

const fromArray = (v: ArrayLike<number>, offset = 0): Vec3 =>
  of(v[offset], v[offset + 1], v[offset + 2]);

const toStr = (a: Vec3, precision = 3): string =>
  `(${a.x.toFixed(precision)}, ${a.y.toFixed(precision)}, ${a.z.toFixed(precision)})`;

export const vec3 = {
  of,
  add,
  sub,
  scale,
  mul,
  dot,
  cross,
  len,
  len2,
  normalize,
  neg,
  lerp,
  dist,
  equals,
  isZero,
  clone,
  toArray,
  fromArray,
  toString: toStr,
};

const between = (a: Vec3, b: Vec3): number => {
  const la = len(a);
  const lb = len(b);
  if (la < EPS.LENGTH || lb < EPS.LENGTH) return 0;
  let c = dot(a, b) / (la * lb);
  if (c > 1) c = 1;
  else if (c < -1) c = -1;
  return Math.acos(c);
};

const signedAround = (axis: Vec3, from: Vec3, to: Vec3): number => {
  const n = normalize(axis);
  if (isZero(n, EPS.LENGTH)) return 0;
  // Compare the in-plane components so out-of-plane tilt does not flip the sign.
  const f = sub(from, scale(n, dot(from, n)));
  const t = sub(to, scale(n, dot(to, n)));
  if (isZero(f, EPS.LENGTH) || isZero(t, EPS.LENGTH)) return 0;
  return (dot(cross(f, t), n) < 0 ? -1 : 1) * between(f, t);
};

const toDegrees = (radians: number): number => (radians * 180) / Math.PI;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const angle = { between, signedAround, toDegrees, toRadians };
