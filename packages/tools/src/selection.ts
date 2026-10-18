import { edges, faces, loops, selectedVertices, edgeKey } from "@gabarito/core";
import type { Model } from "@gabarito/core";

export function selectionAt(
  model: Model,
  id: string,
  clicks: number,
): string[] {
  const entity = model.entities[id];
  if (!entity) return [];
  if (clicks <= 1) return [id];
  const vertices = selectedVertices(model, [id]);
  const selected = new Set([id, ...vertices]);
  if (clicks === 2) {
    if (entity.kind === "face") {
      const boundary = new Set(
        loops(entity).flatMap((loop) =>
          loop.map((a, i) => edgeKey(a, loop[(i + 1) % loop.length])),
        ),
      );
      for (const edge of edges(model))
        if (boundary.has(edgeKey(...edge.vertices))) selected.add(edge.id);
    }
    return [...selected];
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges(model))
      if (edge.vertices.some((id) => vertices.has(id))) {
        selected.add(edge.id);
        for (const id of edge.vertices)
          if (!vertices.has(id)) {
            vertices.add(id);
            changed = true;
          }
      }
  }
  for (const face of faces(model))
    if (
      loops(face)
        .flat()
        .some((id) => vertices.has(id))
    )
      selected.add(face.id);
  for (const id of vertices) selected.add(id);
  return [...selected];
}
