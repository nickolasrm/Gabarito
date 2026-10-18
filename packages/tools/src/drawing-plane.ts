import {
  EPS,
  V,
  sub,
  dot,
  cross,
  length,
  unit,
  plane,
  onPlane,
  near,
  closestOnSegment,
  planeKey,
} from "@gabarito/geometry";
import type { Vec3, Plane, Ray } from "@gabarito/geometry";
import {
  faces,
  edges,
  loops,
  position,
  facePlane,
  referenceLines,
} from "@gabarito/core";
import type { Model } from "@gabarito/core";
import type { ToolHit } from "./types";
export interface DrawingPlane {
  frame: Plane;
  label: string;
}

/** Infer support from the targeted boundary, never from an unrelated face behind it. */
export function inferRectanglePlane(
  model: Model,
  hit: ToolHit | null,
  anchor: Vec3 | null,
  ray: Ray,
  fallback: DrawingPlane,
): DrawingPlane {
  if (!hit) return fallback;
  const diagonal = anchor ? sub(hit.point, anchor) : null;
  const onSegment = (p: Vec3, a: Vec3, b: Vec3) =>
    near(p, closestOnSegment(p, a, b));
  const incident = edges(model).filter((e) => {
    const [a, b] = e.vertices.map((id) => position(model, id));
    return onSegment(hit.point, a, b) || (anchor && onSegment(anchor, a, b));
  });
  const directions = incident.map((e) =>
    sub(position(model, e.vertices[1]), position(model, e.vertices[0])),
  );
  const ruler = referenceLines(model).find((g) => g.id === hit.id);
  if (ruler) directions.push(ruler.direction);
  const edgeScore = (d: Vec3) =>
    diagonal && length(diagonal) > EPS
      ? Math.abs(Math.abs(dot(unit(d), unit(diagonal))) - Math.SQRT1_2)
      : -Math.abs(dot(unit(d), fallback.frame.u));
  const align = (frame: Plane): Plane => {
    const local = directions
      .filter((d) => Math.abs(dot(unit(d), frame.normal)) < EPS)
      .sort(
        (a, b) =>
          edgeScore(a) - edgeScore(b) ||
          Math.abs(dot(unit(b), frame.u)) - Math.abs(dot(unit(a), frame.u)),
      );
    if (!local.length) return frame;
    let u = unit(local[0]);
    if (
      dot(u, frame.u) < -EPS ||
      (Math.abs(dot(u, frame.u)) <= EPS && dot(u, frame.v) < 0)
    )
      u = { x: -u.x, y: -u.y, z: -u.z };
    return { ...frame, u, v: cross(frame.normal, u) };
  };
  const candidates = faces(model)
    .filter(
      (f) =>
        f.id === hit.id ||
        loops(f).some((loop) =>
          loop.some((id, i) => {
            const a = position(model, id),
              b = position(model, loop[(i + 1) % loop.length]);
            return (
              onSegment(hit.point, a, b) || (anchor && onSegment(anchor, a, b))
            );
          }),
        ),
    )
    .map((f) => ({ face: f, frame: facePlane(model, f) }))
    .filter(
      (c) =>
        onPlane(hit.point, c.frame) && (!anchor || onPlane(anchor, c.frame)),
    );
  candidates.sort(
    (a, b) =>
      Number(b.face.id === hit.id) - Number(a.face.id === hit.id) ||
      Math.abs(dot(b.frame.normal, ray.direction)) -
        Math.abs(dot(a.frame.normal, ray.direction)) ||
      planeKey(a.frame).localeCompare(planeKey(b.frame)),
  );
  if (candidates.length)
    return {
      frame: align(candidates[0].frame),
      label: hit.kind === "face" ? "Face" : "Boundary",
    };
  const edgePlanes: Plane[] = [];
  if (diagonal && length(diagonal) > EPS) {
    for (const edge of incident) {
      const [a, b] = edge.vertices.map((id) => position(model, id));
      // A ground-level edge alone must not tilt a ground drawing.
      if (Math.abs(a.z) < EPS && Math.abs(b.z) < EPS) continue;
      const n = cross(sub(b, a), diagonal);
      if (length(n) > EPS) edgePlanes.push(plane(anchor!, n));
    }
    if (ruler) {
      const n = cross(ruler.direction, diagonal);
      if (length(n) > EPS) edgePlanes.push(plane(anchor!, n));
    }
  } else
    for (let i = 0; i < directions.length; i++)
      for (let j = i + 1; j < directions.length; j++) {
        const n = cross(directions[i], directions[j]);
        if (length(n) > EPS) edgePlanes.push(plane(hit.point, n));
      }
  edgePlanes.sort(
    (a, b) =>
      Math.abs(dot(b.normal, ray.direction)) -
        Math.abs(dot(a.normal, ray.direction)) ||
      planeKey(a).localeCompare(planeKey(b)),
  );
  if (edgePlanes.length) return { frame: align(edgePlanes[0]), label: "Edges" };
  return fallback;
}
export const defaultDrawingPlane = (origin = V()): DrawingPlane => ({
  frame: plane(origin, V(0, 0, 1)),
  label: Math.abs(origin.z) > EPS ? "Point" : "Ground",
});
