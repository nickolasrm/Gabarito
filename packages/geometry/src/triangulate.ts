import { type Vec3 } from "./vec3";
import { EPS } from "./tol";
import { dominantAxis, poly as polyOps, project2D, type Vec2 } from "./poly";

const fan = (points: Vec3[]): number[] => {
  const n = points.length;
  if (n < 3) return [];
  const out: number[] = [];
  for (let i = 1; i < n - 1; i++) out.push(0, i, i + 1);
  return out;
};

const cross2D = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const pointInTriangle = (p: Vec2, a: Vec2, b: Vec2, c: Vec2, sign: number, eps: number): boolean =>
  cross2D(a, b, p) * sign >= -eps &&
  cross2D(b, c, p) * sign >= -eps &&
  cross2D(c, a, p) * sign >= -eps;

const isEar = (
  pts: Vec2[],
  prev: number,
  cur: number,
  next: number,
  indices: number[],
  sign: number,
): boolean => {
  const a = pts[prev];
  const b = pts[cur];
  const c = pts[next];
  if (cross2D(a, b, c) * sign <= EPS.MERGE) return false;
  for (const k of indices) {
    if (k === prev || k === cur || k === next) continue;
    if (pointInTriangle(pts[k], a, b, c, sign, EPS.LENGTH)) return false;
  }
  return true;
};

const polygon = (points: Vec3[], normal?: Vec3): number[] => {
  const n = points.length;
  if (n < 3) return [];

  const nr = normal ?? polyOps.normal(points);
  if (!nr) return [];

  const projected = project2D(points, dominantAxis(nr));

  let area2 = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area2 += projected[j].x * projected[i].y - projected[i].x * projected[j].y;
  }
  if (Math.abs(area2) < EPS.MERGE) return [];

  const sign = area2 > 0 ? 1 : -1;
  const indices: number[] = [];
  for (let i = 0; i < n; i++) indices.push(i);

  const out: number[] = [];
  let guard = 0;
  const maxGuard = n * n + 16;
  while (indices.length > 3 && guard++ < maxGuard) {
    let clipped = false;
    for (let i = 0; i < indices.length; i++) {
      const prev = indices[(i - 1 + indices.length) % indices.length];
      const cur = indices[i];
      const next = indices[(i + 1) % indices.length];
      if (isEar(projected, prev, cur, next, indices, sign)) {
        out.push(prev, cur, next);
        indices.splice(i, 1);
        clipped = true;
        break;
      }
    }
    if (!clipped) return fan(points);
  }

  if (indices.length !== 3) return fan(points);
  out.push(indices[0], indices[1], indices[2]);
  return out;
};

export const triangulate = { polygon, fan };
