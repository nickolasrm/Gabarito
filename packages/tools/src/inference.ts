import { EPS, ray as rayOps, segment as segmentOps, vec3 } from "@gabarito/geometry";
import type { Ray, Segment, Vec3 } from "@gabarito/geometry";
import { documentBounds, edgesOf, getPoint, guidesOf, pointsOf } from "@gabarito/core";
import type { DocumentState } from "@gabarito/core";
import { AXIS_DIRECTIONS, projectOntoAxis } from "./axis-lock";
import type { AxisLockState, SnapKind, SnapResult } from "./types";

/** Lower wins when two candidates are equally close. Matches the table in spec 0006. */
const PRIORITY: Record<SnapKind, number> = {
  endpoint: 0,
  intersection: 1,
  midpoint: 2,
  edge: 3,
  extension: 4,
  guide: 5,
  axis: 6,
  face: 7,
  free: 8,
};

const MAX_INTERSECTION_PAIRS = 600;
/** How close the pointer must look to an axis before inference binds to it, in pixels. */
const AXIS_SCREEN_TOLERANCE = 10;

/** Snaps to real geometry. These beat inferred axes and the bare drawing plane. */
const GEOMETRY_SNAPS: SnapKind[] = ["endpoint", "intersection", "midpoint", "edge", "extension", "guide"];

interface Candidate {
  point: Vec3;
  kind: SnapKind;
  label: string;
  radius: number;
  axis: { origin: Vec3; direction: Vec3 } | null;
  axisKey: "x" | "y" | "z" | null;
}

export interface ResolveInput {
  doc: DocumentState;
  /** The pointer position on the drawing plane, before inference. */
  free: Vec3;
  /** Snap radius in world units, derived from screen pixels. */
  tolerance: number;
  /** Reference point for axis inference and axis locks. */
  anchor: Vec3 | null;
  lock: AxisLockState | null;
  /** `plane` keeps the point free in the lock plane instead of pinning it to the axis. */
  lockMode?: "axis" | "plane";
  /**
   * The pointer ray. Axis inference uses it instead of the point on the drawing plane,
   * which is the only way the third dimension is reachable: a point on the ground plane
   * can never be near the vertical line through the anchor.
   */
  ray?: Ray;
  /** Pointer position in screen pixels, and a projector, for the screen-space axis gate. */
  screen?: { x: number; y: number };
  project?: (point: Vec3) => { x: number; y: number; visible: boolean };
  snapping: boolean;
}

function guideExtent(doc: DocumentState): number {
  const bounds = documentBounds(doc);
  if (!bounds) return 100_000;
  return Math.max(vec3.dist(bounds.min, bounds.max) * 4, 100_000);
}

function guideSegment(origin: Vec3, direction: Vec3, extent: number): Segment {
  return {
    a: vec3.sub(origin, vec3.scale(direction, extent)),
    b: vec3.add(origin, vec3.scale(direction, extent)),
  };
}

function nearestVertex(doc: DocumentState, point: Vec3, tolerance: number): Vec3 | null {
  let best: Vec3 | null = null;
  let bestDistance = tolerance;
  for (const vertex of pointsOf(doc)) {
    const distance = vec3.dist(vertex.position, point);
    if (distance <= bestDistance) {
      best = vertex.position;
      bestDistance = distance;
    }
  }
  return best;
}

function edgeSegments(doc: DocumentState): Segment[] {
  const segments: Segment[] = [];
  for (const edge of edgesOf(doc)) {
    const a = getPoint(doc, edge.points[0]);
    const b = getPoint(doc, edge.points[1]);
    if (a && b) segments.push({ a, b });
  }
  return segments;
}

/**
 * Inference over the document plus virtual geometry: guide lines count as edges, and the
 * crossings of guides with edges and with each other count as vertices (spec 0006).
 */
export function resolveSnap(input: ResolveInput): SnapResult {
  const { doc, free, tolerance, anchor, lock, ray, screen, project, snapping } = input;
  const lockMode = input.lockMode ?? "axis";

  if (lock && lockMode === "axis") {
    const projected = projectOntoAxis(free, lock);
    const vertex = nearestVertex(doc, projected, tolerance);
    return {
      point: vertex ?? projected,
      kind: vertex ? "endpoint" : "axis",
      label: vertex ? "Endpoint on axis" : `On ${lock.axisKey.toUpperCase()} axis`,
      axis: { origin: lock.origin, direction: lock.direction },
      axisKey: lock.axisKey,
    };
  }

  if (!snapping) {
    return { point: free, kind: "free", label: "Free", axis: null, axisKey: null };
  }

  const candidates: Candidate[] = [];
  const push = (candidate: Omit<Candidate, "axis" | "axisKey">): void => {
    candidates.push({ ...candidate, axis: null, axisKey: null });
  };

  // Endpoints reach further than other snaps on purpose. A loop only closes if the
  // closing click lands on the existing vertex, and a few pixels short used to create a
  // duplicate point, leaving the polygon open with no face.
  const vertexTolerance = tolerance * 1.4;
  for (const vertex of pointsOf(doc)) {
    const radius = vec3.dist(vertex.position, free);
    if (radius <= vertexTolerance) {
      push({ point: vertex.position, kind: "endpoint", label: "Endpoint", radius });
    }
  }

  for (const segment of edgeSegments(doc)) {
    const midpoint = segmentOps.midpoint(segment);
    const midpointRadius = vec3.dist(midpoint, free);
    if (midpointRadius <= tolerance) {
      push({ point: midpoint, kind: "midpoint", label: "Midpoint", radius: midpointRadius });
    }
    const closest = segmentOps.closestPointToPoint(segment, free);
    const radius = vec3.dist(closest.point, free);
    if (closest.t > 0.02 && closest.t < 0.98 && radius <= tolerance) {
      push({ point: closest.point, kind: "edge", label: "On Edge", radius });
    }
  }

  const extent = guideExtent(doc);
  const guides = guidesOf(doc).map((guide) => ({
    origin: guide.origin,
    direction: guide.direction,
    segment: guideSegment(guide.origin, guide.direction, extent),
  }));

  for (const guide of guides) {
    const closest = segmentOps.closestPointToPoint(guide.segment, free);
    const radius = vec3.dist(closest.point, free);
    if (radius <= tolerance) {
      push({ point: closest.point, kind: "guide", label: "On Guide", radius });
    }
  }

  const solids = edgeSegments(doc);
  let pairs = 0;
  const considerCrossing = (a: Segment, b: Segment, label: string): void => {
    if (pairs >= MAX_INTERSECTION_PAIRS) return;
    pairs += 1;
    const closest = segmentOps.closestPoints(a, b);
    if (closest.dist > EPS.MERGE * 10) return;
    const radius = vec3.dist(closest.onA, free);
    if (radius > tolerance) return;
    push({ point: closest.onA, kind: "intersection", label, radius });
  };

  for (let i = 0; i < solids.length; i += 1) {
    for (let j = i + 1; j < solids.length; j += 1) {
      considerCrossing(solids[i], solids[j], "Intersection");
    }
  }
  for (const segment of solids) {
    for (const guide of guides) considerCrossing(segment, guide.segment, "Edge ∩ Guide");
  }
  for (let i = 0; i < guides.length; i += 1) {
    for (let j = i + 1; j < guides.length; j += 1) {
      considerCrossing(guides[i].segment, guides[j].segment, "Guide ∩ Guide");
    }
  }

  // Extension of an edge away from the anchor.
  if (anchor) {
    for (const segment of solids) {
      const atA = vec3.dist(segment.a, anchor) <= tolerance;
      const atB = vec3.dist(segment.b, anchor) <= tolerance;
      if (!atA && !atB) continue;
      const direction = vec3.normalize(vec3.sub(atB ? segment.a : segment.b, anchor));
      if (vec3.isZero(direction)) continue;
      const along = vec3.dot(vec3.sub(free, anchor), direction);
      if (along <= 0) continue;
      const projected = vec3.add(anchor, vec3.scale(direction, along));
      const radius = vec3.dist(projected, free);
      if (radius <= tolerance) {
        push({ point: projected, kind: "extension", label: "On Edge Extension", radius });
      }
    }

    const delta = vec3.sub(free, anchor);
    // A pinned axis is the user's instruction; do not let inference fight it.
    if (!lock && !vec3.isZero(delta, EPS.MERGE)) {
      const keys: Array<"x" | "y" | "z"> = ["x", "y", "z"];
      for (const axisKey of keys) {
        const direction = AXIS_DIRECTIONS[axisKey];
        if (ray) {
          const half = 1e6;
          const line = {
            a: vec3.sub(anchor, vec3.scale(direction, half)),
            b: vec3.add(anchor, vec3.scale(direction, half)),
          };
          const closest = rayOps.closestPointsToSegment(ray, line);
          if (closest.tRay <= 0) continue;
          // Gate on screen distance, not the 3D distance between the ray and the line. A
          // line nearly parallel to the view can be far from the axis on screen while the
          // ray-to-line distance stays small, which snaps clicks the user aimed elsewhere.
          const onScreen = project?.(closest.onSegment);
          if (screen && onScreen) {
            if (!onScreen.visible) continue;
            const pixels = Math.hypot(onScreen.x - screen.x, onScreen.y - screen.y);
            if (pixels > AXIS_SCREEN_TOLERANCE) continue;
          } else if (closest.dist > tolerance * 1.5) {
            continue;
          }
          candidates.push({
            point: closest.onSegment,
            kind: "axis",
            label: `On ${axisKey.toUpperCase()} axis`,
            radius: closest.dist,
            axis: { origin: anchor, direction },
            axisKey,
          });
          continue;
        }
        const along = vec3.dot(delta, direction);
        const projected = vec3.add(anchor, vec3.scale(direction, along));
        const radius = vec3.dist(projected, free);
        if (radius <= tolerance * 1.5) {
          candidates.push({
            point: projected,
            kind: "axis",
            label: `On ${axisKey.toUpperCase()} axis`,
            radius,
            axis: { origin: anchor, direction },
            axisKey,
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { point: free, kind: "face", label: "On Face", axis: null, axisKey: null };
  }

  // Real geometry always beats an inferred axis or the bare plane, even when the axis is
  // closer: a user pointing near a corner means the corner, not "somewhere on the X axis".
  const geometrySnaps = candidates.filter((candidate) => GEOMETRY_SNAPS.includes(candidate.kind));
  const pool = geometrySnaps.length > 0 ? geometrySnaps : candidates;

  pool.sort((a, b) => {
    const gap = a.radius - b.radius;
    if (Math.abs(gap) > tolerance * 0.15) return gap;
    return PRIORITY[a.kind] - PRIORITY[b.kind];
  });

  const best = pool[0];
  return {
    point: best.point,
    kind: best.kind,
    label: best.label,
    axis: best.axis,
    axisKey: best.axisKey,
  };
}
