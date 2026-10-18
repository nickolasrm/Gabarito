import { EPS, add, sub, mul, dot, normal } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { surface } from "@gabarito/core";
import type { Model } from "@gabarito/core";
import type { ToolHit, ToolView } from "./types";
import type { Inference } from "./face-snap";

export function snapAlongAxis(
  m: Model,
  start: Vec3,
  free: Vec3,
  direction: Vec3,
  excludedId: string,
  hit: ToolHit | null,
  view: ToolView,
  tolerance = 8,
): Inference | null {
  if (!hit || hit.id === excludedId || !view.visible(hit.point)) return null;
  let distance = dot(sub(hit.point, start), direction);
  if (hit.kind === "face") {
    const f = m.entities[hit.id];
    if (f?.kind !== "face") return null;
    const s = surface(m, f),
      n = normal(s.outer),
      denominator = dot(n, direction);
    if (Math.abs(denominator) < EPS) return null;
    distance = dot(sub(s.outer[0], start), n) / denominator;
  }
  const point = add(start, mul(direction, distance)),
    p = view.project(point),
    q = view.project(free);
  if (
    !p.visible ||
    (Math.abs(distance) < EPS &&
      (!q.visible || Math.hypot(p.x - q.x, p.y - q.y) > tolerance))
  )
    return null;
  return {
    point,
    hit,
    lines: [[hit.point, point]],
    label: `${hit.kind === "vertex" ? "Vertex" : hit.kind === "edge" ? "Edge" : hit.kind === "guide" ? "Ruler" : "Face"} level`,
  };
}
