import {
  EPS,
  V,
  add,
  sub,
  mul,
  dot,
  unit,
  axisPoint,
  intersectPlane,
  plane,
  scale,
} from "@gabarito/geometry";
import type { Vec3, Segment, Ray } from "@gabarito/geometry";
import { selectedVertices, position } from "@gabarito/core";
import type { Model } from "@gabarito/core";
export const coordinates = ["x", "y", "z"] as const;
export interface ScaleGrip {
  id: string;
  point: Vec3;
  anchor: Vec3;
  axes: (typeof coordinates)[number][];
  uniform: boolean;
  label: string;
}
export interface ScaleBox {
  min: Vec3;
  max: Vec3;
  grips: ScaleGrip[];
  lines: Segment[];
}
export function scaleBox(m: Model): ScaleBox | null {
  const points = [...selectedVertices(m, m.selection)].map((id) =>
    position(m, id),
  );
  if (!points.length) return null;
  const min = V(),
    max = V();
  for (const a of coordinates) {
    min[a] = Infinity;
    max[a] = -Infinity;
    for (const p of points) {
      min[a] = Math.min(min[a], p[a]);
      max[a] = Math.max(max[a], p[a]);
    }
  }
  const active = coordinates.filter((a) => max[a] - min[a] > EPS),
    grips: ScaleGrip[] = [],
    lines: Segment[] = [];
  if (!active.length) return { min, max, grips, lines };
  const mid = mul(add(min, max), 0.5);
  for (const x of active.includes("x") ? [-1, 0, 1] : [0])
    for (const y of active.includes("y") ? [-1, 0, 1] : [0])
      for (const z of active.includes("z") ? [-1, 0, 1] : [0]) {
        const signs = V(x, y, z),
          axes = active.filter((a) => signs[a] !== 0);
        if (!axes.length) continue;
        const point = { ...mid },
          anchor = { ...mid };
        for (const a of axes) {
          point[a] = signs[a] < 0 ? min[a] : max[a];
          anchor[a] = signs[a] < 0 ? max[a] : min[a];
        }
        const uniform = axes.length === active.length && active.length > 1;
        grips.push({
          id: `${x},${y},${z}`,
          point,
          anchor,
          axes,
          uniform,
          label: uniform
            ? "Proportional scale"
            : `Stretch ${axes.join("/").toUpperCase()}`,
        });
      }
  const corners = grips.filter((g) => g.axes.length === active.length);
  for (let i = 0; i < corners.length; i++)
    for (let j = i + 1; j < corners.length; j++)
      if (
        active.filter(
          (a) => Math.abs(corners[i].point[a] - corners[j].point[a]) > EPS,
        ).length === 1
      )
        lines.push([corners[i].point, corners[j].point]);
  return { min, max, grips, lines };
}
export function gripFactors(grip: ScaleGrip, ray: Ray): Vec3 | null {
  const d = sub(grip.point, grip.anchor),
    f = V(1, 1, 1);
  let end: Vec3 | null;
  if (grip.uniform || grip.axes.length === 1)
    end = axisPoint(ray, grip.anchor, unit(d));
  else {
    const other = coordinates.find((a) => !grip.axes.includes(a))!;
    const n = V();
    n[other] = 1;
    end = intersectPlane(ray, plane(grip.point, n));
  }
  if (!end) return null;
  if (grip.uniform) {
    const factor = dot(sub(end, grip.anchor), d) / dot(d, d);
    for (const a of grip.axes) f[a] = factor;
  } else for (const a of grip.axes) f[a] = (end[a] - grip.anchor[a]) / d[a];
  return f;
}
export function transformBox(
  box: ScaleBox,
  anchor: Vec3,
  factors: Vec3,
): ScaleBox {
  const transform = (p: Vec3) => scale(p, anchor, factors);
  return {
    ...box,
    min: transform(box.min),
    max: transform(box.max),
    lines: box.lines.map((l) => [transform(l[0]), transform(l[1])]),
    grips: box.grips.map((g) => ({ ...g, point: transform(g.point) })),
  };
}
