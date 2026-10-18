export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Ray {
  origin: Vec3;
  direction: Vec3;
}
export interface Plane {
  origin: Vec3;
  normal: Vec3;
  u: Vec3;
  v: Vec3;
}
export type Axis = "x" | "y" | "z";
export const EPS = 1e-5;
export const V = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 =>
  V(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 =>
  V(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: Vec3, k: number): Vec3 => V(a.x * k, a.y * k, a.z * k);
export const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const unit = (a: Vec3): Vec3 =>
  length(a) > EPS ? mul(a, 1 / length(a)) : V();
export const near = (a: Vec3, b: Vec3): boolean => length(sub(a, b)) <= EPS;
export const axisVector = (a: Axis): Vec3 =>
  V(a === "x" ? 1 : 0, a === "y" ? 1 : 0, a === "z" ? 1 : 0);
export const finite = (p: Vec3): boolean =>
  [p.x, p.y, p.z].every(Number.isFinite);
export function normal(loop: Vec3[]): Vec3 {
  let n = V();
  for (let i = 0; i < loop.length; i++)
    n = add(n, cross(loop[i], loop[(i + 1) % loop.length]));
  return unit(n);
}
export function plane(origin: Vec3, n: Vec3): Plane {
  n = unit(n);
  const reference = Math.abs(n.z) < 0.9 ? V(0, 0, 1) : V(0, 1, 0);
  const u = unit(cross(reference, n));
  return { origin, normal: n, u, v: cross(n, u) };
}
export function canonicalPlane(origin: Vec3, n: Vec3): Plane {
  n = unit(n);
  const first = [n.x, n.y, n.z].find((k) => Math.abs(k) > EPS) ?? 0;
  if (first < 0) n = mul(n, -1);
  return plane(mul(n, dot(origin, n)), n);
}
export const onPlane = (p: Vec3, f: Plane): boolean =>
  Math.abs(dot(sub(p, f.origin), f.normal)) < EPS;
export const project = (p: Vec3, f: Plane): [number, number] => [
  dot(sub(p, f.origin), f.u),
  dot(sub(p, f.origin), f.v),
];
export const unproject = (p: [number, number], f: Plane): Vec3 =>
  add(f.origin, add(mul(f.u, p[0]), mul(f.v, p[1])));
export function intersectPlane(ray: Ray, f: Plane): Vec3 | null {
  const denominator = dot(ray.direction, f.normal);
  if (Math.abs(denominator) < 1e-9) return null;
  const t = dot(sub(f.origin, ray.origin), f.normal) / denominator;
  return t >= 0 ? add(ray.origin, mul(ray.direction, t)) : null;
}
export function closestOnSegment(p: Vec3, a: Vec3, b: Vec3): Vec3 {
  const d = sub(b, a),
    t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d)));
  return add(a, mul(d, t));
}
export function axisPoint(ray: Ray, origin: Vec3, direction: Vec3): Vec3 {
  const d = unit(direction),
    w = sub(origin, ray.origin),
    c = dot(d, ray.direction);
  const denominator = 1 - c * c;
  return denominator > 1e-9
    ? add(origin, mul(d, (c * dot(ray.direction, w) - dot(d, w)) / denominator))
    : origin;
}
export function rotate(p: Vec3, center: Vec3, axis: Vec3, angle: number): Vec3 {
  const d = sub(p, center),
    n = unit(axis),
    c = Math.cos(angle),
    s = Math.sin(angle);
  return add(
    center,
    add(add(mul(d, c), mul(cross(n, d), s)), mul(n, dot(n, d) * (1 - c))),
  );
}
export function area2(loop: [number, number][]): number {
  return (
    loop.reduce((s, a, i) => {
      const b = loop[(i + 1) % loop.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2
  );
}
export function inside(
  p: [number, number],
  loop: [number, number][],
  boundary = true,
): boolean {
  let result = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[j],
      b = loop[i];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy);
    if (
      l > EPS &&
      Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) < EPS * l &&
      (p[0] - a[0]) * (p[0] - b[0]) + (p[1] - a[1]) * (p[1] - b[1]) <= EPS * EPS
    )
      return boundary;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
export function planeKey(f: Plane): string {
  return [f.normal.x, f.normal.y, f.normal.z, dot(f.normal, f.origin)]
    .map((x) => Math.round(x / EPS))
    .join(",");
}

export const scale = (p: Vec3, anchor: Vec3, factors: Vec3): Vec3 =>
  V(
    anchor.x + (p.x - anchor.x) * factors.x,
    anchor.y + (p.y - anchor.y) * factors.y,
    anchor.z + (p.z - anchor.z) * factors.z,
  );
