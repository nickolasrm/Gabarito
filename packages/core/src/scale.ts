import { finite, scale, add, sub, unit } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { selectedVertices } from "./model";
import type { Model } from "./model";

export function scaleSelection(
  m: Model,
  ids: string[],
  anchor: Vec3,
  factors: Vec3,
): void {
  if (
    !finite(anchor) ||
    !finite(factors) ||
    Math.min(factors.x, factors.y, factors.z) <= 0
  )
    throw new Error("Scale factors must be finite and positive");
  const vertices = selectedVertices(m, ids),
    rulers = ids.map((id) => m.entities[id]).filter((e) => e?.kind === "guide");
  if (!vertices.size && !rulers.length)
    throw new Error("Select geometry to scale");
  for (const id of vertices) {
    const v = m.entities[id];
    if (v.kind === "vertex") v.position = scale(v.position, anchor, factors);
  }
  for (const g of new Set(rulers)) {
    const end = scale(add(g.origin, g.direction), anchor, factors);
    g.origin = scale(g.origin, anchor, factors);
    g.direction = unit(sub(end, g.origin));
  }
}
