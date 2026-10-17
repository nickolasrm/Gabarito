import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";

/**
 * Normal of a plane that contains `axis` and faces the camera as squarely as possible.
 *
 * It is the component of the view direction perpendicular to the axis. The obvious
 * `cross(axis, viewDirection)` is wrong: it is perpendicular to the view direction too,
 * which makes the plane edge-on to the camera, so the pointer ray never hits it and every
 * point collapses onto the previous cursor.
 */
export function axisPlaneNormal(axis: Vec3, viewDirection: Vec3): Vec3 {
  const direction = vec3.normalize(axis);
  const along = vec3.dot(viewDirection, direction);
  const facing = vec3.sub(viewDirection, vec3.scale(direction, along));
  if (vec3.isZero(facing, 0.05)) {
    // Looking straight down the axis: no plane containing it faces the camera. Any
    // perpendicular will do, and the user can still rotate the view.
    const reference = Math.abs(direction.z) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
    return vec3.normalize(vec3.cross(direction, reference));
  }
  return vec3.normalize(facing);
}

/** An orthonormal basis for a plane containing `axis`, with `u` along the axis. */
export function axisPlaneBasis(axis: Vec3, normal: Vec3, origin: Vec3): {
  plane: { origin: Vec3; normal: Vec3 };
  normal: Vec3;
  u: Vec3;
  v: Vec3;
} {
  const u = vec3.normalize(axis);
  return { plane: { origin, normal }, normal, u, v: vec3.normalize(vec3.cross(normal, u)) };
}
