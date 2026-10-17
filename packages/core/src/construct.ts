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
  /**
   * Faces to remove before adding `entities`, as one transaction. The extrusion replaces its
   * source face when that face ends up on the wrong side of the new solid.
   */
  removeFaceIds?: EntityId[];
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
  const offset = bottom.map((position) => buildPoint(doc, vec3.add(position, delta)));
  if (offset.some((entry) => !entry.created)) return EMPTY;

  const entities: Entity[] = offset.map((entry) => entry.point);
  const sourceIds = face.points;
  const offsetIds = offset.map((entry) => entry.point.id);
  const count = sourceIds.length;

  // Which cap sits at the lower axial coordinate decides the winding of everything: walls run
  // lower -> lower -> upper -> upper, the lower cap points against the normal and the upper cap
  // along it. Getting this wrong leaves one face of the solid pointing into itself.
  const sourceIsNear = distance > 0;
  const nearIds = sourceIsNear ? sourceIds : offsetIds;
  const farIds = sourceIsNear ? offsetIds : sourceIds;

  const addEdge = (a: EntityId, b: EntityId) => {
    if (a === b) return;
    if (findEdgeBetween(doc, a, b)) return;
    if (
      entities.some(
        (item) => item.kind === "edge" && item.points.includes(a) && item.points.includes(b),
      )
    ) {
      return;
    }
    entities.push({ id: allocId(doc, "e"), kind: "edge", points: [a, b] });
  };

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    addEdge(nearIds[index], nearIds[next]);
    addEdge(farIds[index], farIds[next]);
    addEdge(nearIds[index], farIds[index]);
    entities.push({
      id: allocId(doc, "f"),
      kind: "face",
      points: [nearIds[index], nearIds[next], farIds[next], farIds[index]],
    });
  }

  // Caps: the lower one points against the normal, the upper one along it.
  const lowerCap = nearIds.slice().reverse();
  entities.push({ id: allocId(doc, "f"), kind: "face", points: lowerCap });
  entities.push({ id: allocId(doc, "f"), kind: "face", points: farIds });

  // When the source face ends up as the lower cap it points the wrong way, so it is replaced by
  // the reversed copy above.
  return { entities, removeFaceIds: sourceIsNear ? [faceId] : [] };
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
