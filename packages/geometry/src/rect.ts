import { EPS } from "./tol";
import { vec3 } from "./vec3";
import type { Vec3 } from "./vec3";

/** One of the three world axes. The tool this exists for works axis-aligned (decision 0022). */
export type Axis = "x" | "y" | "z";

/**
 * An axis-aligned rectangle lying in a plane perpendicular to `axis`.
 *
 * Working axis-aligned keeps this to arithmetic on ranges, which is the whole reason straight cuts
 * need no kernel: a rectangle minus a rectangle is at most four rectangles, and never a hole.
 */
export interface PlaneRect {
  axis: Axis;
  /** Position along `axis`. */
  value: number;
  /** In-plane ranges, always in the order given by `inPlaneAxes`. */
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/** The two in-plane axes, ordered so a CCW loop in (u, v) has its normal along +axis. */
export function inPlaneAxes(axis: Axis): [Axis, Axis] {
  // Cyclic order: y-hat cross x-hat is -y, so (x, z) was wound against the axis for y faces
  // and every face built from those corners pointed into its solid.
  if (axis === "x") return ["y", "z"];
  if (axis === "y") return ["z", "x"];
  return ["x", "y"];
}

function component(point: Vec3, axis: Axis): number {
  return axis === "x" ? point.x : axis === "y" ? point.y : point.z;
}

/** Empty when the range collapses, which is how callers drop slivers. */
function isEmpty(rect: PlaneRect): boolean {
  return rect.uMax - rect.uMin <= EPS.MERGE || rect.vMax - rect.vMin <= EPS.MERGE;
}

export const rect = {
  inPlaneAxes,

  /** Read a polygon as an axis-aligned rectangle, or nothing if it is not one. */
  fromPolygon(points: Vec3[]): PlaneRect | null {
    if (points.length !== 4) return null;
    const normal = this.axisOfPolygon(points);
    if (!normal) return null;
    const { axis, value } = normal;
    const [u, v] = inPlaneAxes(axis);
    const us = points.map((point) => component(point, u));
    const vs = points.map((point) => component(point, v));
    const candidate: PlaneRect = {
      axis,
      value,
      uMin: Math.min(...us),
      uMax: Math.max(...us),
      vMin: Math.min(...vs),
      vMax: Math.max(...vs),
    };
    // Four corners and the extremes of both in-plane axes: anything else is not a rectangle.
    if (isEmpty(candidate)) return null;
    const expected = new Set([
      `${candidate.uMin},${candidate.vMin}`,
      `${candidate.uMax},${candidate.vMin}`,
      `${candidate.uMax},${candidate.vMax}`,
      `${candidate.uMin},${candidate.vMax}`,
    ]);
    const actual = new Set(points.map((point) => `${component(point, u)},${component(point, v)}`));
    if (actual.size !== 4) return null;
    for (const corner of actual) {
      if (!expected.has(corner)) return null;
    }
    return candidate;
  },

  /** The normal axis of a flat polygon whose plane is perpendicular to a world axis. */
  axisOfPolygon(points: Vec3[]): { axis: Axis; value: number } | null {
    if (points.length < 3) return null;
    for (const axis of ["x", "y", "z"] as Axis[]) {
      const values = points.map((point) => component(point, axis));
      if (Math.max(...values) - Math.min(...values) <= EPS.MERGE) {
        return { axis, value: values[0] };
      }
    }
    return null;
  },

  isEmpty,

  area(value: PlaneRect): number {
    return Math.max(0, value.uMax - value.uMin) * Math.max(0, value.vMax - value.vMin);
  },

  /** The overlap of two rectangles in the same plane, or nothing. */
  intersect(a: PlaneRect, b: PlaneRect): PlaneRect | null {
    if (a.axis !== b.axis || Math.abs(a.value - b.value) > EPS.MERGE) return null;
    const overlap: PlaneRect = {
      axis: a.axis,
      value: a.value,
      uMin: Math.max(a.uMin, b.uMin),
      uMax: Math.min(a.uMax, b.uMax),
      vMin: Math.max(a.vMin, b.vMin),
      vMax: Math.min(a.vMax, b.vMax),
    };
    return isEmpty(overlap) ? null : overlap;
  },

  /** Four corners, wound counter-clockwise about the positive `axis`. */
  corners(value: PlaneRect): Vec3[] {
    const [u, v] = inPlaneAxes(value.axis);
    const at = (uValue: number, vValue: number): Vec3 => {
      const point = { x: 0, y: 0, z: 0 };
      point[value.axis] = value.value;
      point[u] = uValue;
      point[v] = vValue;
      return point;
    };
    return [
      at(value.uMin, value.vMin),
      at(value.uMax, value.vMin),
      at(value.uMax, value.vMax),
      at(value.uMin, value.vMax),
    ];
  },

  /** Corners wound so the face points away from `centre`, which is what a shell needs. */
  cornersOutward(value: PlaneRect, centre: Vec3): Vec3[] {
    const corners = this.corners(value);
    const middle = vec3.scale(corners.reduce((sum, point) => vec3.add(sum, point), vec3.of(0, 0, 0)), 0.25);
    const normal = this.normalOf(value);
    return vec3.dot(normal, vec3.sub(middle, centre)) >= 0 ? corners : corners.reverse();
  },

  /** Unit normal along the positive axis. */
  normalOf(value: PlaneRect): Vec3 {
    return value.axis === "x" ? vec3.of(1, 0, 0) : value.axis === "y" ? vec3.of(0, 1, 0) : vec3.of(0, 0, 1);
  },

};
