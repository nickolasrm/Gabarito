import { EPS, poly as polyOps, vec3 } from "@gabarito/geometry";
import { allocId, facePositions, findEdgeBetween, findPointNear } from "./document";
import { detectFaces } from "./face-detection";
import type {
  DocumentState,
  EdgeEntity,
  Entity,
  EntityId,
  FaceEntity,
  GuideEntity,
  DimensionEntity,
  PointEntity,
  Vec3,
} from "./types";

/** Entities produced by a construct helper, ready to be added in one command. */
export interface BuildResult {
  entities: Entity[];
}

const EMPTY: BuildResult = { entities: [] };

function buildPoint(doc: DocumentState, position: Vec3): { point: PointEntity; created: boolean } {
  const existing = findPointNear(doc, position);
  if (existing) return { point: existing, created: false };
  return { point: { id: allocId(doc, "p"), kind: "point", position }, created: true };
}

function isPlanarLoop(positions: Vec3[]): boolean {
  if (positions.length < 3) return false;
  const normal = polyOps.normal(positions);
  if (!normal) return false;
  return polyOps.isPlanar(positions, EPS.MERGE) && polyOps.area(positions) > EPS.MERGE;
}

/**
 * Weld the endpoints, create the edge, and close a face if the new edge completes a
 * planar loop of existing edges.
 */
export function buildEdge(doc: DocumentState, a: Vec3, b: Vec3): BuildResult {
  const start = buildPoint(doc, a);
  const end = buildPoint(doc, b);
  if (start.point.id === end.point.id) return EMPTY;
  if (findEdgeBetween(doc, start.point.id, end.point.id)) return EMPTY;

  const edge: EdgeEntity = {
    id: allocId(doc, "e"),
    kind: "edge",
    points: [start.point.id, end.point.id],
  };

  const entities: Entity[] = [];
  if (start.created) entities.push(start.point);
  if (end.created) entities.push(end.point);
  entities.push(edge);

  entities.push(...detectFaces(doc, edge));

  return { entities };
}

/** Four edges and a face from a corner and two edge vectors. */
export function buildRectangle(
  doc: DocumentState,
  corner: Vec3,
  u: Vec3,
  v: Vec3,
): BuildResult {
  const corners = [corner, vec3.add(corner, u), vec3.add(vec3.add(corner, u), v), vec3.add(corner, v)];
  if (!isPlanarLoop(corners)) return EMPTY;

  const built = corners.map((position) => buildPoint(doc, position));
  const ids = built.map((entry) => entry.point.id);
  if (new Set(ids).size !== 4) return EMPTY;

  const entities: Entity[] = built.filter((entry) => entry.created).map((entry) => entry.point);

  for (let index = 0; index < 4; index += 1) {
    const a = ids[index];
    const b = ids[(index + 1) % 4];
    if (findEdgeBetween(doc, a, b)) continue;
    entities.push({ id: allocId(doc, "e"), kind: "edge", points: [a, b] });
  }

  const alreadyHasFace = Object.values(doc.entities).some(
    (entity) =>
      entity.kind === "face" && [...entity.points].sort().join("|") === [...ids].sort().join("|"),
  );
  if (!alreadyHasFace) entities.push({ id: allocId(doc, "f"), kind: "face", points: ids });

  return { entities };
}

/** A closed loop of edges plus a face, used for tessellated circles. */
export function buildPolygonFace(doc: DocumentState, positions: Vec3[]): BuildResult {
  if (positions.length < 3 || !isPlanarLoop(positions)) return EMPTY;

  const built = positions.map((position) => buildPoint(doc, position));
  const ids = built.map((entry) => entry.point.id);
  if (new Set(ids).size < 3) return EMPTY;

  const entities: Entity[] = built.filter((entry) => entry.created).map((entry) => entry.point);

  for (let index = 0; index < ids.length; index += 1) {
    const a = ids[index];
    const b = ids[(index + 1) % ids.length];
    if (findEdgeBetween(doc, a, b)) continue;
    entities.push({ id: allocId(doc, "e"), kind: "edge", points: [a, b] });
  }

  entities.push({ id: allocId(doc, "f"), kind: "face", points: ids });

  return { entities };
}

/**
 * Extrude a face along its normal into a closed solid: side walls, connecting edges,
 * and a cap. No boolean operation is involved (decision 0011, interim).
 */
export function buildExtrusion(
  doc: DocumentState,
  faceId: EntityId,
  distance: number,
  direction?: Vec3,
): BuildResult {
  const entity = doc.entities[faceId];
  if (!entity || entity.kind !== "face") return EMPTY;
  const face = entity as FaceEntity;
  const bottom = facePositions(doc, face);
  if (bottom.length < 3) return EMPTY;
  if (Math.abs(distance) < EPS.LENGTH) return EMPTY;

  const faceNormal = polyOps.normal(bottom);
  if (!faceNormal) return EMPTY;
  // A pinned axis can pull along a direction other than the face normal.
  const normal = direction ? vec3.normalize(direction) : faceNormal;
  if (vec3.isZero(normal)) return EMPTY;

  const delta = vec3.scale(normal, distance);
  const top = bottom.map((position) => buildPoint(doc, vec3.add(position, delta)));
  if (top.some((entry) => !entry.created)) return EMPTY;

  const entities: Entity[] = top.map((entry) => entry.point);
  const bottomIds = face.points;
  const topIds = top.map((entry) => entry.point.id);
  const count = bottomIds.length;

  const addEdge = (a: EntityId, b: EntityId) => {
    if (a === b) return;
    if (findEdgeBetween(doc, a, b)) return;
    if (entities.some((item) => item.kind === "edge" && item.points.includes(a) && item.points.includes(b))) {
      return;
    }
    entities.push({ id: allocId(doc, "e"), kind: "edge", points: [a, b] });
  };

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    addEdge(topIds[index], topIds[next]);
    addEdge(bottomIds[index], topIds[index]);
    entities.push({
      id: allocId(doc, "f"),
      kind: "face",
      points: [bottomIds[index], bottomIds[next], topIds[next], topIds[index]],
    });
  }

  entities.push({ id: allocId(doc, "f"), kind: "face", points: topIds });

  return { entities };
}

/** An infinite construction line through a point, in a direction. */
export function buildGuide(doc: DocumentState, origin: Vec3, direction: Vec3): BuildResult {
  const unit = vec3.normalize(direction);
  if (vec3.isZero(unit)) return EMPTY;
  const guide: GuideEntity = { id: allocId(doc, "g"), kind: "guide", origin, direction: unit };
  return { entities: [guide] };
}

/** A distance annotation between two points. */
export function buildDimension(doc: DocumentState, a: Vec3, b: Vec3): BuildResult {
  if (vec3.dist(a, b) < EPS.LENGTH) return EMPTY;
  const dimension: DimensionEntity = { id: allocId(doc, "d"), kind: "dimension", a, b };
  return { entities: [dimension] };
}
