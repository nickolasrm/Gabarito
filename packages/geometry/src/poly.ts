import { vec3, type Vec3 } from "./vec3";
import { EPS } from "./tol";

export type Vec2 = { x: number; y: number };

export function dominantAxis(n: Vec3): 0 | 1 | 2 {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  if (ax >= ay && ax >= az) return 0;
  if (ay >= az) return 1;
  return 2;
}

export function projectPoint2D(p: Vec3, axis: 0 | 1 | 2): Vec2 {
  if (axis === 0) return { x: p.y, y: p.z };
  if (axis === 1) return { x: p.x, y: p.z };
  return { x: p.x, y: p.y };
}

export function project2D(points: Vec3[], axis: 0 | 1 | 2): Vec2[] {
  return points.map((p) => projectPoint2D(p, axis));
}

// Newell's method: the unnormalised result is twice the vector area.
function newell(points: Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    x += (a.y - b.y) * (a.z + b.z);
    y += (a.z - b.z) * (a.x + b.x);
    z += (a.x - b.x) * (a.y + b.y);
  }
  return { x, y, z };
}

const average = (points: Vec3[]): Vec3 => {
  let acc = vec3.of(0, 0, 0);
  for (const p of points) acc = vec3.add(acc, p);
  return vec3.scale(acc, 1 / points.length);
};

const normal = (points: Vec3[]): Vec3 | null => {
  if (points.length < 3) return null;
  const n = newell(points);
  return vec3.isZero(n, EPS.LENGTH) ? null : vec3.normalize(n);
};

const area = (points: Vec3[]): number => (points.length < 3 ? 0 : vec3.len(newell(points)) / 2);

const centroid = (points: Vec3[]): Vec3 => {
  if (points.length === 0) return vec3.of(0, 0, 0);
  const nr = normal(points);
  if (!nr) return average(points);
  let sumW = 0;
  let acc = vec3.of(0, 0, 0);
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const w = vec3.dot(vec3.cross(a, b), nr);
    sumW += w;
    acc = vec3.add(acc, vec3.scale(vec3.add(a, b), w));
  }
  if (Math.abs(sumW) < EPS.MERGE) return average(points);
  return vec3.scale(acc, 1 / (3 * sumW));
};

const perimeter = (points: Vec3[]): number => {
  const n = points.length;
  if (n < 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) total += vec3.dist(points[i], points[(i + 1) % n]);
  return total;
};

const isPlanar = (points: Vec3[], eps: number = EPS.MERGE): boolean => {
  const nr = normal(points);
  if (!nr) return true;
  const c = average(points);
  for (const p of points) {
    if (Math.abs(vec3.dot(vec3.sub(p, c), nr)) > eps) return false;
  }
  return true;
};

const cross2D = (o: Vec2, a: Vec2, b: Vec2): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const onSegment2D = (a: Vec2, b: Vec2, p: Vec2, eps: number): boolean => {
  if (Math.abs(cross2D(a, b, p)) > eps) return false;
  return (
    p.x >= Math.min(a.x, b.x) - eps &&
    p.x <= Math.max(a.x, b.x) + eps &&
    p.y >= Math.min(a.y, b.y) - eps &&
    p.y <= Math.max(a.y, b.y) + eps
  );
};

function contains2D(pts: Vec2[], p: Vec2, eps: number): boolean {
  const n = pts.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (onSegment2D(a, b, p, eps)) return true;
    if (a.y > p.y !== b.y > p.y) {
      const x = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (p.x < x) inside = !inside;
    }
  }
  return inside;
}

const containsPoint = (points: Vec3[], point: Vec3, eps: number = EPS.LENGTH): boolean => {
  if (points.length < 3) return false;
  const nr = normal(points);
  if (!nr) return false;
  const axis = dominantAxis(nr);
  const pts = project2D(points, axis);
  if (Math.abs(signedAreaOf(pts)) < EPS.MERGE) return false;
  return contains2D(pts, projectPoint2D(point, axis), eps);
};

const signedAreaOf = (pts: Vec2[]): number => {
  let sum = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    sum += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return sum / 2;
};

const signedArea2D = (points: Vec3[], n: Vec3): number => vec3.dot(newell(points), n) / 2;

const orient = (points: Vec3[], n: Vec3): Vec3[] => {
  const copy = points.slice();
  return signedArea2D(points, n) < 0 ? copy.reverse() : copy;
};

const dedupe = (points: Vec3[], eps: number = EPS.MERGE): Vec3[] => {
  const out: Vec3[] = [];
  for (const p of points) {
    if (out.length === 0 || vec3.dist(out[out.length - 1], p) > eps) out.push(p);
  }
  if (out.length > 1 && vec3.dist(out[0], out[out.length - 1]) <= eps) out.pop();
  return out;
};

export const poly = {
  normal,
  area,
  centroid,
  perimeter,
  isPlanar,
  containsPoint,
  orient,
  dedupe,
  signedArea2D,
};

export { signedAreaOf };
