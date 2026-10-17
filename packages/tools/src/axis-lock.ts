import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import type { AxisLockState } from "./types";

export const AXIS_DIRECTIONS: Record<"x" | "y" | "z", Vec3> = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

export const AXIS_LABELS: Record<"x" | "y" | "z", string> = {
  x: "X (red)",
  y: "Y (green)",
  z: "Z (blue)",
};

/**
 * Arrow keys pin an axis for the operation in progress; `↓` clears it (spec 0006).
 * Shift inverts the sign so a lock can also mean "the negative direction".
 */
export function axisForArrow(
  key: string,
  shift: boolean,
): { axisKey: "x" | "y" | "z"; sign: 1 | -1 } | null {
  switch (key) {
    case "ArrowRight":
      return { axisKey: "x", sign: shift ? -1 : 1 };
    case "ArrowLeft":
      return { axisKey: "y", sign: shift ? -1 : 1 };
    case "ArrowUp":
      return { axisKey: "z", sign: shift ? -1 : 1 };
    default:
      return null;
  }
}

export function createAxisLock(
  axisKey: "x" | "y" | "z",
  sign: 1 | -1,
  origin: Vec3,
): AxisLockState {
  return { axisKey, direction: vec3.scale(AXIS_DIRECTIONS[axisKey], sign), origin };
}

/** Project a point onto the line through the lock origin along the locked axis. */
export function projectOntoAxis(point: Vec3, lock: AxisLockState): Vec3 {
  const relative = vec3.sub(point, lock.origin);
  const along = vec3.dot(relative, lock.direction);
  return vec3.add(lock.origin, vec3.scale(lock.direction, along));
}
