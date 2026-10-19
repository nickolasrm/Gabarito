import {
  EPS,
  canonicalPlane,
  normal,
  onPlane,
  project,
  inside,
  closestOnSegment,
  sub,
  length,
} from "./math";
import type { Vec3 } from "./math";
import type { Surface } from "./kernel";
export function insetDistance(surface: Surface, point: Vec3): number | null {
  const frame = canonicalPlane(surface.outer[0], normal(surface.outer));
  if (
    !onPlane(point, frame) ||
    !inside(
      project(point, frame),
      surface.outer.map((p) => project(p, frame)),
    ) ||
    surface.holes.some((h) =>
      inside(
        project(point, frame),
        h.map((p) => project(p, frame)),
        false,
      ),
    )
  )
    return null;
  let distance = Infinity;
  for (const loop of [surface.outer, ...surface.holes])
    for (let i = 0; i < loop.length; i++)
      distance = Math.min(
        distance,
        length(
          sub(
            point,
            closestOnSegment(point, loop[i], loop[(i + 1) % loop.length]),
          ),
        ),
      );
  return distance > EPS ? distance : 0;
}
