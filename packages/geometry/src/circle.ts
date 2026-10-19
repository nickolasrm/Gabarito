import { EPS, add, sub, mul, dot, cross, unit, length, finite } from "./math";
import type { Vec3, Plane } from "./math";
export const DEFAULT_CIRCLE_SEGMENTS = 24;
export function circlePoints(
  center: Vec3,
  frame: Plane,
  radius: number,
  segments = DEFAULT_CIRCLE_SEGMENTS,
  radial = frame.u,
): Vec3[] {
  if (!finite(center) || !Number.isFinite(radius) || radius <= EPS)
    throw new Error("Enter a positive circle radius");
  if (!Number.isInteger(segments) || segments < 3 || segments > 256)
    throw new Error("Circle segments must be an integer from 3 to 256");
  const projected = sub(radial, mul(frame.normal, dot(radial, frame.normal))),
    u = length(projected) > EPS ? unit(projected) : frame.u,
    v = cross(frame.normal, u);
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i * 2 * Math.PI) / segments;
    return add(
      center,
      add(mul(u, radius * Math.cos(angle)), mul(v, radius * Math.sin(angle))),
    );
  });
}
