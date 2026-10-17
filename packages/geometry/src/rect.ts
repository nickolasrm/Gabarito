import { EPS } from "./tol";
import { vec3 } from "./vec3";
import type { Vec3 } from "./vec3";

/** One of the three world axes. The tool this exists for works axis-aligned (decision 0021). */
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

  /**
   * `outer` minus `inner`, in the same plane.
   *
   * At most four rectangles, and never a hole: a document face is a single loop, so a hole cannot be
   * represented, and this is why the straight case is expressible at all (decision 0021).
   */
  subtract(outer: PlaneRect, inner: PlaneRect): PlaneRect[] {
    const overlap = this.intersect(outer, inner);
    if (!overlap) return [outer];

    const pieces: PlaneRect[] = [
      { ...outer, vMin: outer.vMin, vMax: outer.vMax, uMin: outer.uMin, uMax: overlap.uMin },
      { ...outer, uMin: overlap.uMax, uMax: outer.uMax },
      { ...outer, uMin: overlap.uMin, uMax: overlap.uMax, vMin: outer.vMin, vMax: overlap.vMin },
      { ...outer, uMin: overlap.uMin, uMax: overlap.uMax, vMin: overlap.vMax, vMax: outer.vMax },
    ];
    return pieces.filter((piece) => !isEmpty(piece));
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

/** Rounded key for merging coincident vertices. Matches the weld the document applies. */
const VERTEX_KEY = 1e-3;

/**
 * Split rectangles until no vertex of one lies strictly inside the edge of another.
 *
 * Subdividing a face subdivides the edges it shares with its neighbours, and the neighbours must
 * carry the same subdivision or the surface has T-junctions: geometrically closed, but the edges no
 * longer match by their endpoints, which breaks the every-edge-is-shared-by-two-faces rule the shell
 * invariant relies on. Each split is along an existing vertex, so the pass terminates.
 *
 * Carries arbitrary metadata through the splits, because callers attach orientation to each piece.
 */
export function conformRects<T>(
  items: ReadonlyArray<{ piece: PlaneRect; meta: T }>,
): Array<{ piece: PlaneRect; meta: T }> {
  let current = [...items];

  const component = (point: Vec3, axis: Axis): number =>
    axis === "x" ? point.x : axis === "y" ? point.y : point.z;

  for (let guard = 0; guard < 200; guard += 1) {
    const vertices: Vec3[] = [];
    const seen = new Set<string>();
    for (const { piece } of current) {
      for (const corner of rect.corners(piece)) {
        const key = `${Math.round(corner.x / VERTEX_KEY)},${Math.round(corner.y / VERTEX_KEY)},${Math.round(
          corner.z / VERTEX_KEY,
        )}`;
        if (!seen.has(key)) {
          seen.add(key);
          vertices.push(corner);
        }
      }
    }

    let split: { index: number; along: "u" | "v"; at: number } | null = null;
    for (let index = 0; index < current.length && !split; index += 1) {
      const { piece } = current[index];
      const [u, v] = inPlaneAxes(piece.axis);
      for (const vertex of vertices) {
        if (Math.abs(component(vertex, piece.axis) - piece.value) > VERTEX_KEY) continue;
        const vu = component(vertex, u);
        const vv = component(vertex, v);
        const onURange =
          Math.abs(vv - piece.vMin) <= VERTEX_KEY || Math.abs(vv - piece.vMax) <= VERTEX_KEY;
        const onVRange =
          Math.abs(vu - piece.uMin) <= VERTEX_KEY || Math.abs(vu - piece.uMax) <= VERTEX_KEY;
        // Strictly inside, and far enough from the ends that the halves stay real rectangles.
        if (onURange && vu > piece.uMin + VERTEX_KEY && vu < piece.uMax - VERTEX_KEY) {
          split = { index, along: "u", at: vu };
          break;
        }
        if (onVRange && vv > piece.vMin + VERTEX_KEY && vv < piece.vMax - VERTEX_KEY) {
          split = { index, along: "v", at: vv };
          break;
        }
      }
    }

    if (!split) return current;
    const { piece, meta } = current[split.index];
    const halves =
      split.along === "u"
        ? [
            { piece: { ...piece, uMax: split.at }, meta },
            { piece: { ...piece, uMin: split.at }, meta },
          ]
        : [
            { piece: { ...piece, vMax: split.at }, meta },
            { piece: { ...piece, vMin: split.at }, meta },
          ];
    current = [...current.slice(0, split.index), ...halves, ...current.slice(split.index + 1)];
  }

  return current;
}
