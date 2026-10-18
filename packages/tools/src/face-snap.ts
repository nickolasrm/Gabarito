import {
  EPS,
  add,
  sub,
  mul,
  dot,
  cross,
  length,
  unit,
  near,
  onPlane,
  project,
  inside,
  closestOnSegment,
} from "@gabarito/geometry";
import type { Vec3, Plane, Segment } from "@gabarito/geometry";
import { faces, loops, position, edges } from "@gabarito/core";
import type { Model } from "@gabarito/core";
import type { ToolHit, ToolView } from "./types";

export interface Inference {
  point: Vec3;
  hit: ToolHit;
  lines: Segment[];
  label: string;
}
export function snapOnFace(
  m: Model,
  frame: Plane,
  end: Vec3,
  view: ToolView,
  tolerance = 8,
): Inference | null {
  const candidates: (Inference & { pixels: number; priority: number })[] = [];
  const screen = view.project(end);
  if (!screen.visible) return null;
  for (const face of faces(m)) {
    if (!face.outer.every((id) => onPlane(position(m, id), frame))) continue;
    const material = (p: Vec3) =>
      inside(
        project(p, frame),
        face.outer.map((id) => project(position(m, id), frame)),
      ) &&
      !face.holes.some((l) =>
        inside(
          project(p, frame),
          l.map((id) => project(position(m, id), frame)),
          false,
        ),
      );
    if (!material(end)) continue;
    const references: {
      origin: Vec3;
      direction: Vec3;
      segment?: Segment;
      label: string;
      snap: "alignment" | "diagonal";
    }[] = [];
    for (const l of loops(face))
      l.forEach((id, i) => {
        const a = position(m, id),
          b = position(m, l[(i + 1) % l.length]),
          midpoint = mul(add(a, b), 0.5);
        if (view.visible(midpoint))
          references.push({
            origin: midpoint,
            direction: unit(cross(frame.normal, sub(b, a))),
            label: "Midpoint alignment",
            snap: "alignment",
          });
      });
    // Collinear boundary splits do not change a quadrilateral's diagonals.
    const outer = face.outer.map((id) => position(m, id));
    const corners = outer.filter(
      (p, i) =>
        length(
          cross(
            sub(p, outer[(i + outer.length - 1) % outer.length]),
            sub(outer[(i + 1) % outer.length], p),
          ),
        ) > EPS,
    );
    if (corners.length === 4)
      for (let i = 0; i < 2; i++) {
        const a = corners[i],
          b = corners[i + 2];
        if (view.visible(a) && view.visible(b))
          references.push({
            origin: a,
            direction: unit(sub(b, a)),
            segment: [a, b],
            label: "Face diagonal",
            snap: "diagonal",
          });
      }
    const addCandidate = (
      point: Vec3,
      refs: typeof references,
      priority: number,
    ) => {
      const p = view.project(point),
        pixels = Math.hypot(p.x - screen.x, p.y - screen.y);
      if (
        !p.visible ||
        pixels > tolerance ||
        !material(point) ||
        !view.visible(point)
      )
        return;
      candidates.push({
        point,
        hit: { id: face.id, kind: "face", point, snap: refs[0].snap },
        lines: refs.map((r) => r.segment ?? [r.origin, point]),
        label: priority === 0 ? "Reference intersection" : refs[0].label,
        pixels,
        priority,
      });
    };
    references.forEach((r) =>
      addCandidate(
        r.segment
          ? closestOnSegment(end, ...r.segment)
          : add(
              r.origin,
              mul(r.direction, dot(sub(end, r.origin), r.direction)),
            ),
        [r],
        1,
      ),
    );
    for (let i = 0; i < references.length; i++)
      for (let j = i + 1; j < references.length; j++) {
        const a = references[i],
          b = references[j],
          n = cross(a.direction, b.direction),
          size = dot(n, n);
        if (size < EPS * EPS) continue;
        const point = add(
          a.origin,
          mul(
            a.direction,
            dot(cross(sub(b.origin, a.origin), b.direction), n) / size,
          ),
        );
        if (
          [a, b].some(
            (r) =>
              r.segment && !near(point, closestOnSegment(point, ...r.segment)),
          )
        )
          continue;
        addCandidate(point, [a, b], 0);
      }
  }
  candidates.sort((a, b) => a.priority - b.priority || a.pixels - b.pixels);
  return candidates[0] ?? null;
}

/** Midpoint semantics follow their source edge even if represented as a virtual vertex. */
export function midpointEdge(m: Model, hit: ToolHit): string | undefined {
  if (hit.snap !== "midpoint") return undefined;
  if (hit.sourceEdge && m.entities[hit.sourceEdge]?.kind === "edge")
    return hit.sourceEdge;
  if (m.entities[hit.id]?.kind === "edge") return hit.id;
  return edges(m).find((e) =>
    near(
      hit.point,
      mul(
        add(...(e.vertices.map((id) => position(m, id)) as [Vec3, Vec3])),
        0.5,
      ),
    ),
  )?.id;
}
