import { bounds as boundsOps, vec3 } from "@gabarito/geometry";
import type { Bounds } from "@gabarito/geometry";
import {
  DEFAULT_SETTINGS,
  type DocumentState,
  type EdgeEntity,
  type Entity,
  type EntityId,
  type FaceEntity,
  type GuideEntity,
  type DimensionEntity,
  type PointEntity,
  type Settings,
  type Vec3,
} from "./types";

/** Points closer than this are treated as the same vertex when welding. */
export const WELD_TOLERANCE = 1e-3;

export function createDocument(settings?: Partial<Settings>): DocumentState {
  return {
    revision: 0,
    nextId: 1,
    entities: {},
    selection: [],
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

export function allocId(doc: DocumentState, prefix: string): EntityId {
  return `${prefix}${doc.nextId++}`;
}

function collect<T extends Entity["kind"]>(
  doc: DocumentState,
  kind: T,
): Extract<Entity, { kind: T }>[] {
  const out: Extract<Entity, { kind: T }>[] = [];
  for (const entity of Object.values(doc.entities)) {
    if (entity.kind === kind) out.push(entity as Extract<Entity, { kind: T }>);
  }
  return out;
}

export const pointsOf = (doc: DocumentState): PointEntity[] => collect(doc, "point");
export const edgesOf = (doc: DocumentState): EdgeEntity[] => collect(doc, "edge");
export const facesOf = (doc: DocumentState): FaceEntity[] => collect(doc, "face");
export const guidesOf = (doc: DocumentState): GuideEntity[] => collect(doc, "guide");
export const dimensionsOf = (doc: DocumentState): DimensionEntity[] => collect(doc, "dimension");

export function getPoint(doc: DocumentState, id: EntityId): Vec3 | null {
  const entity = doc.entities[id];
  return entity && entity.kind === "point" ? entity.position : null;
}

export function pointPositions(doc: DocumentState, ids: EntityId[]): Vec3[] {
  const out: Vec3[] = [];
  for (const id of ids) {
    const position = getPoint(doc, id);
    if (position) out.push(position);
  }
  return out;
}

export function facePositions(doc: DocumentState, face: FaceEntity): Vec3[] {
  return pointPositions(doc, face.points);
}

/** The positions of each hole loop of a face, in order; empty when the face has no hole. */
export function faceHoles(doc: DocumentState, face: FaceEntity): Vec3[][] {
  return (face.holes ?? []).map((loop) => pointPositions(doc, loop));
}

export function edgePositions(doc: DocumentState, edge: EdgeEntity): [Vec3, Vec3] | null {
  const a = getPoint(doc, edge.points[0]);
  const b = getPoint(doc, edge.points[1]);
  if (!a || !b) return null;
  return [a, b];
}

export function findPointNear(
  doc: DocumentState,
  position: Vec3,
  tolerance = WELD_TOLERANCE,
): PointEntity | null {
  let best: PointEntity | null = null;
  let bestDistance = tolerance;
  for (const point of pointsOf(doc)) {
    const distance = vec3.dist(point.position, position);
    if (distance <= bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

export function findEdgeBetween(doc: DocumentState, a: EntityId, b: EntityId): EdgeEntity | null {
  for (const edge of edgesOf(doc)) {
    if (
      (edge.points[0] === a && edge.points[1] === b) ||
      (edge.points[0] === b && edge.points[1] === a)
    ) {
      return edge;
    }
  }
  return null;
}

/**
 * The set of points that move when the given entities move. Annotations are ignored:
 * a guide is a reference, not something that drags with a face (decision 0014).
 */
export function pointIdsForEntities(doc: DocumentState, ids: EntityId[]): EntityId[] {
  const out = new Set<EntityId>();
  for (const id of ids) {
    const entity = doc.entities[id];
    if (!entity) continue;
    if (entity.kind === "point") out.add(entity.id);
    else if (entity.kind === "edge") {
      out.add(entity.points[0]);
      out.add(entity.points[1]);
    } else if (entity.kind === "face") {
      for (const point of entity.points) out.add(point);
    }
  }
  return [...out];
}

export function boundsOfPoints(points: Vec3[]): Bounds | null {
  return boundsOps.fromPoints(points);
}

export function boundsOfEntities(doc: DocumentState, ids: EntityId[]): Bounds | null {
  const points: Vec3[] = [];
  for (const id of ids) {
    const entity = doc.entities[id];
    if (!entity) continue;
    if (entity.kind === "point") points.push(entity.position);
    else if (entity.kind === "edge") {
      const p = getPoint(doc, entity.points[0]);
      const q = getPoint(doc, entity.points[1]);
      if (p) points.push(p);
      if (q) points.push(q);
    } else if (entity.kind === "face") {
      points.push(...pointPositions(doc, entity.points));
    } else if (entity.kind === "guide") points.push(entity.origin);
    else if (entity.kind === "dimension") points.push(entity.a, entity.b);
  }
  return boundsOfPoints(points);
}

export function documentBounds(doc: DocumentState): Bounds | null {
  return boundsOfEntities(doc, Object.keys(doc.entities));
}

export function entityLabel(doc: DocumentState, id: EntityId): string {
  const entity = doc.entities[id];
  if (!entity) return "missing";
  switch (entity.kind) {
    case "point":
      return "point";
    case "edge":
      return "edge";
    case "face":
      return "face";
    case "guide":
      return "guide";
    case "dimension":
      return "dimension";
  }
}

/** Entities that would be destroyed by removing the given ids, including the ids themselves. */
export function removalClosure(doc: DocumentState, ids: EntityId[]): EntityId[] {
  const removed = new Set<EntityId>(ids.filter((id) => doc.entities[id] !== undefined));
  const removedEdgePairs: Array<[EntityId, EntityId]> = [];
  for (const id of removed) {
    const entity = doc.entities[id];
    if (entity && entity.kind === "edge") removedEdgePairs.push([entity.points[0], entity.points[1]]);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of Object.values(doc.entities)) {
      if (removed.has(entity.id)) continue;
      if (entity.kind === "edge") {
        if (removed.has(entity.points[0]) || removed.has(entity.points[1])) {
          removed.add(entity.id);
          removedEdgePairs.push([entity.points[0], entity.points[1]]);
          changed = true;
        }
      } else if (entity.kind === "face") {
        const touchesRemovedPoint = entity.points.some((point) => removed.has(point));
        const touchesRemovedEdge = removedEdgePairs.some(
          ([a, b]) => entity.points.includes(a) && entity.points.includes(b),
        );
        if (touchesRemovedPoint || touchesRemovedEdge) {
          removed.add(entity.id);
          changed = true;
        }
      }
    }
  }

  // Orphan points: referenced by nothing that survives.
  for (const point of pointsOf(doc)) {
    if (removed.has(point.id)) continue;
    const referenced = Object.values(doc.entities).some((entity) => {
      if (removed.has(entity.id)) return false;
      if (entity.kind === "edge") return entity.points.includes(point.id);
      if (entity.kind === "face") return entity.points.includes(point.id);
      return false;
    });
    if (!referenced) removed.add(point.id);
  }

  return [...removed];
}
