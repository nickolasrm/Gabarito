import {
  createModel,
  expandModel,
  vertices,
  faces,
  edges,
  position,
  loops,
  edgeKey,
} from "@gabarito/core";
import type { Model } from "@gabarito/core";

export interface ComponentPreview {
  faces: string[];
  lines: string;
  points: { x: number; y: number }[];
}
/** A compact isometric view of definition geometry, independent of the scene camera. */
export function componentPreview(
  definitions: Model["definitions"],
  id: string,
): ComponentPreview {
  const definition = definitions[id];
  if (!definition) return { faces: [], lines: "", points: [] };
  const model = expandModel({
      ...createModel(),
      ...definition.geometry,
      definitions,
    }),
    vs = vertices(model);
  if (!vs.length) return { faces: [], lines: "", points: [] };
  const xy = new Map(
    vs.map((v) => [
      v.id,
      {
        x: v.position.x + v.position.y,
        y: (v.position.y - v.position.x) * 0.5 - v.position.z,
      },
    ]),
  );
  const values = [...xy.values()],
    minX = Math.min(...values.map((p) => p.x)),
    maxX = Math.max(...values.map((p) => p.x)),
    minY = Math.min(...values.map((p) => p.y)),
    maxY = Math.max(...values.map((p) => p.y));
  const scale = 60 / Math.max(maxX - minX, maxY - minY, 1e-5);
  const point = (id: string) => {
    const p = xy.get(id)!;
    return {
      x: 36 + (p.x - (minX + maxX) / 2) * scale,
      y: 36 + (p.y - (minY + maxY) / 2) * scale,
    };
  };
  const coordinates = (id: string) => {
    const p = point(id);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  };
  const path = (ids: string[]) => `M${ids.map(coordinates).join("L")}Z`;
  const fs = faces(model),
    depth = (ids: string[]) =>
      ids.reduce((sum, id) => {
        const p = position(model, id);
        return sum - p.x + p.y + p.z;
      }, 0) / ids.length;
  fs.sort((a, b) => depth(a.outer) - depth(b.outer));
  const boundaries = new Set(
      fs.flatMap((f) =>
        loops(f).flatMap((l) =>
          l.map((a, i) => edgeKey(a, l[(i + 1) % l.length])),
        ),
      ),
    ),
    es = edges(model),
    connected = new Set(es.flatMap((e) => e.vertices));
  return {
    faces: fs.map((f) => loops(f).map(path).join("")),
    lines: es
      .filter((e) => !boundaries.has(edgeKey(...e.vertices)))
      .map(
        (e) => `M${coordinates(e.vertices[0])}L${coordinates(e.vertices[1])}`,
      )
      .join(""),
    points: vs.filter((v) => !connected.has(v.id)).map((v) => point(v.id)),
  };
}
