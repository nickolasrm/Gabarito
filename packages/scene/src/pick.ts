import { ray as rayOps, plane as planeOps, poly as polyOps, vec3 } from "@gabarito/geometry";
import type { Ray, Vec3 } from "@gabarito/geometry";
import { edgesOf, facePositions, facesOf, getPoint, guidesOf, dimensionsOf } from "@gabarito/core";
import type { DocumentState, EntityId } from "@gabarito/core";

export interface PickHit {
  entityId: EntityId;
  kind: "point" | "edge" | "face" | "guide" | "dimension";
  point: Vec3;
  distance: number;
}

interface Candidate extends PickHit {
  t: number;
}

function faceCandidate(ray: Ray, entityId: EntityId, positions: Vec3[]): Candidate | null {
  const normal = polyOps.normal(positions);
  if (!normal) return null;
  const plane = planeOps.fromPointNormal(positions[0], normal);
  const hit = rayOps.intersectPlane(ray, plane);
  if (!hit) return null;
  if (!polyOps.containsPoint(positions, hit, 1e-6)) return null;
  const t = vec3.dist(hit, ray.origin);
  return { entityId, kind: "face", point: hit, distance: t, t };
}

function segmentCandidate(
  ray: Ray,
  kind: PickHit["kind"],
  entityId: EntityId,
  a: Vec3,
  b: Vec3,
  tolerance: number,
): Candidate | null {
  const closest = rayOps.closestPointsToSegment(ray, { a, b });
  if (closest.tRay <= 0) return null;
  if (closest.dist > tolerance) return null;
  return {
    entityId,
    kind,
    point: closest.onSegment,
    distance: closest.tRay,
    t: closest.tRay,
  };
}

function pointCandidate(
  ray: Ray,
  kind: PickHit["kind"],
  entityId: EntityId,
  position: Vec3,
  tolerance: number,
): Candidate | null {
  const t = vec3.dot(vec3.sub(position, ray.origin), ray.direction);
  if (t <= 0) return null;
  const closest = vec3.add(ray.origin, vec3.scale(ray.direction, t));
  if (vec3.dist(closest, position) > tolerance) return null;
  return { entityId, kind, point: position, distance: t, t };
}

/**
 * Analytic picking against document entities rather than against rendered meshes:
 * no dependence on three.js objects, and the same maths can be tested headlessly.
 * Faces win over edges win over points at equal distance, which is what a user expects.
 */
export function pick(ray: Ray, doc: DocumentState, tolerance: number): PickHit | null {
  const candidates: Candidate[] = [];

  for (const face of facesOf(doc)) {
    const positions = facePositions(doc, face);
    if (positions.length < 3) continue;
    const candidate = faceCandidate(ray, face.id, positions);
    if (candidate) candidates.push(candidate);
  }

  for (const edge of edgesOf(doc)) {
    const a = getPoint(doc, edge.points[0]);
    const b = getPoint(doc, edge.points[1]);
    if (!a || !b) continue;
    const candidate = segmentCandidate(ray, "edge", edge.id, a, b, tolerance);
    if (candidate) candidates.push(candidate);
  }

  for (const guide of guidesOf(doc)) {
    const huge = 1e6;
    const a = vec3.add(guide.origin, vec3.scale(guide.direction, huge));
    const b = vec3.sub(guide.origin, vec3.scale(guide.direction, huge));
    const candidate = segmentCandidate(ray, "guide", guide.id, a, b, tolerance);
    if (candidate) candidates.push(candidate);
  }

  for (const dimension of dimensionsOf(doc)) {
    const candidate = segmentCandidate(ray, "dimension", dimension.id, dimension.a, dimension.b, tolerance * 2);
    if (candidate) candidates.push(candidate);
  }

  const points = new Map<EntityId, Vec3>();
  for (const edge of edgesOf(doc)) {
    for (const id of edge.points) {
      const position = getPoint(doc, id);
      if (position) points.set(id, position);
    }
  }
  for (const [id, position] of points) {
    const candidate = pointCandidate(ray, "point", id, position, tolerance);
    if (candidate) candidates.push(candidate);
  }

  if (candidates.length === 0) return null;

  const priority: Record<PickHit["kind"], number> = {
    point: 0,
    face: 1,
    edge: 2,
    guide: 3,
    dimension: 4,
  };

  candidates.sort((a, b) => {
    const gap = a.t - b.t;
    const relative = Math.abs(gap) / Math.max(a.t, b.t, 1);
    if (relative > 0.02) return gap;
    return priority[a.kind] - priority[b.kind];
  });

  const best = candidates[0];
  return { entityId: best.entityId, kind: best.kind, point: best.point, distance: best.distance };
}
