import { EPS, conformRects, rect, vec3 } from "@gabarito/geometry";
import type { Axis, PlaneRect, Vec3 } from "@gabarito/geometry";
import { allocId, edgesOf, facePositions, facesOf, pointsOf } from "./document";
import type { DocumentState, Entity, EntityId, FaceEntity } from "./types";

/** Which way a rebuilt face must point, and relative to what. */
interface PieceMeta {
  reference: Vec3;
  toward: boolean;
}

/** Entities to remove and add, applied as one transaction so undo is one step. */
export type CutPlan =
  | { kind: "cut"; remove: EntityId[]; add: Entity[] }
  /** The drag points away from any solid, so material is added: the behaviour push/pull always had. */
  | { kind: "extrude" }
  /** Straight cuts have limits, and a refusal beats a wrong solid (decision 0021). */
  | { kind: "refuse"; error: string };

const AXES: Axis[] = ["x", "y", "z"];

function loopPairKeys(face: FaceEntity): string[] {
  const keys: string[] = [];
  for (let index = 0; index < face.points.length; index += 1) {
    const a = face.points[index];
    const b = face.points[(index + 1) % face.points.length];
    keys.push(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  return keys;
}

/**
 * The faces that bound the solid the given face belongs to.
 *
 * Two faces are neighbours when they share an edge, **or** when they are coplanar and overlap — a
 * smaller face drawn inside a larger one touches it nowhere, and without the second rule the walk
 * never leaves the inner rectangle and no solid is found.
 */
export function shellFaces(doc: DocumentState, start: EntityId): FaceEntity[] {
  const all = facesOf(doc);
  const byId = new Map(all.map((face) => [face.id, face]));
  const startFace = byId.get(start);
  if (!startFace) return [];

  const cache = new Map<EntityId, PlaneRect | null>();
  const rectangleOf = (face: FaceEntity): PlaneRect | null => {
    if (!cache.has(face.id)) cache.set(face.id, rect.fromPolygon(facePositions(doc, face)));
    return cache.get(face.id) ?? null;
  };

  const seen = new Set<EntityId>([start]);
  const queue: EntityId[] = [start];
  while (queue.length > 0) {
    const current = byId.get(queue.shift() as EntityId);
    if (!current) continue;
    const mine = new Set(loopPairKeys(current));
    const mineRect = rectangleOf(current);

    for (const other of all) {
      if (seen.has(other.id)) continue;
      const sharesEdge = loopPairKeys(other).some((key) => mine.has(key));
      let coplanarOverlap = false;
      if (!sharesEdge && mineRect) {
        const theirs = rectangleOf(other);
        if (theirs && rect.intersect(mineRect, theirs)) coplanarOverlap = true;
      }
      if (!sharesEdge && !coplanarOverlap) continue;
      seen.add(other.id);
      queue.push(other.id);
    }
  }
  return [...seen].map((id) => byId.get(id)).filter((face): face is FaceEntity => face !== undefined);
}

interface Box {
  faces: FaceEntity[];
  rectangles: PlaneRect[];
  min: Vec3;
  max: Vec3;
}

/**
 * Read a shell as an axis-aligned box, or nothing.
 *
 * Anything else is refused rather than cut approximately: a wrong solid corrupts snapping and every
 * later cut (decision 0021).
 */
function asAxisAlignedBox(doc: DocumentState, faces: FaceEntity[]): Box | null {
  if (faces.length < 6) return null;
  const rectangles: PlaneRect[] = [];
  for (const face of faces) {
    const value = rect.fromPolygon(facePositions(doc, face));
    if (!value) return null;
    rectangles.push(value);
  }

  const points = faces.flatMap((face) => facePositions(doc, face));
  const min = vec3.of(
    Math.min(...points.map((p) => p.x)),
    Math.min(...points.map((p) => p.y)),
    Math.min(...points.map((p) => p.z)),
  );
  const max = vec3.of(
    Math.max(...points.map((p) => p.x)),
    Math.max(...points.map((p) => p.y)),
    Math.max(...points.map((p) => p.z)),
  );

  // Every face must lie on one of the box's six sides and stay within the box otherwise: that is
  // what makes face subtraction a valid way to cut it.
  for (const face of rectangles) {
    const value = face.value;
    if (Math.abs(value - min[face.axis]) > EPS.MERGE && Math.abs(value - max[face.axis]) > EPS.MERGE) {
      return null;
    }
    const [u, v] = rect.inPlaneAxes(face.axis);
    if (face.uMin < min[u] - EPS.MERGE || face.uMax > max[u] + EPS.MERGE) return null;
    if (face.vMin < min[v] - EPS.MERGE || face.vMax > max[v] + EPS.MERGE) return null;
  }
  return { faces, rectangles, min, max };
}

/** The tool's cross-section in a plane, when the tool reaches that plane at all. */
function toolRectInPlane(
  tool: Record<Axis, [number, number]>,
  axis: Axis,
  value: number,
): PlaneRect | null {
  const [low, high] = tool[axis];
  if (value < low - EPS.MERGE || value > high + EPS.MERGE) return null;
  const [u, v] = rect.inPlaneAxes(axis);
  return {
    axis,
    value,
    uMin: tool[u][0],
    uMax: tool[u][1],
    vMin: tool[v][0],
    vMax: tool[v][1],
  };
}

/** Build fresh entities from rectangles, welding corners between them so the shell stays closed. */
function rebuild(doc: DocumentState, pieces: Array<{ piece: PlaneRect; meta: PieceMeta }>): Entity[] {
  const entities: Entity[] = [];
  const pointIds = new Map<string, EntityId>();
  const edgeKeys = new Set<string>();

  const keyOf = (point: Vec3): string =>
    `${Math.round(point.x / 1e-3)},${Math.round(point.y / 1e-3)},${Math.round(point.z / 1e-3)}`;

  const pointAt = (point: Vec3): EntityId => {
    const key = keyOf(point);
    const existing = pointIds.get(key);
    if (existing) return existing;
    const id = allocId(doc, "p");
    pointIds.set(key, id);
    entities.push({ id, kind: "point", position: point });
    return id;
  };

  for (const { piece, meta } of pieces) {
    const corners = meta.toward
      ? rect.cornersOutward(piece, meta.reference).reverse()
      : rect.cornersOutward(piece, meta.reference);
    const ids = corners.map(pointAt);
    for (let index = 0; index < ids.length; index += 1) {
      const a = ids[index];
      const b = ids[(index + 1) % ids.length];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      entities.push({ id: allocId(doc, "e"), kind: "edge", points: [a, b] });
    }
    entities.push({ id: allocId(doc, "f"), kind: "face", points: ids });
  }
  return entities;
}

/**
 * Plan pushing a face: material removed when the drag goes into a solid, material added when it
 * points away — the behaviour push/pull always had, and still the one that applies with no solid
 * to cut.
 *
 * Straight cuts only. A shell that is not an axis-aligned box of rectangles, or a face that is not
 * a rectangle, is refused with a message and the document is left alone (decision 0021).
 */
export function planCut(doc: DocumentState, faceId: EntityId, distance: number): CutPlan {
  const entity = doc.entities[faceId];
  if (!entity || entity.kind !== "face") return { kind: "refuse", error: "Pick a face to push or pull" };

  const pushed = rect.fromPolygon(facePositions(doc, entity));
  if (!pushed) return { kind: "refuse", error: "Straight cuts need a rectangular face" };
  if (Math.abs(distance) < EPS.LENGTH) return { kind: "refuse", error: "Drag to set the depth" };

  const shell = shellFaces(doc, faceId);
  const box = asAxisAlignedBox(doc, shell);
  // No verifiable solid around the face: material is added, exactly as before this feature.
  if (!box) return { kind: "extrude" };

  const axis = pushed.axis;
  const [u, v] = rect.inPlaneAxes(axis);
  const start = pushed.value;
  const end = start + distance;
  const low = Math.max(Math.min(start, end), box.min[axis]);
  const high = Math.min(Math.max(start, end), box.max[axis]);
  // The drag does not reach into the box, so it grows the solid instead of cutting it.
  if (high - low <= EPS.MERGE) return { kind: "extrude" };

  const tool: Record<Axis, [number, number]> = {
    x: [0, 0],
    y: [0, 0],
    z: [0, 0],
  };
  tool[axis] = [low, high];
  tool[u] = [pushed.uMin, pushed.uMax];
  tool[v] = [pushed.vMin, pushed.vMax];

  const boxCentre = vec3.scale(vec3.add(box.min, box.max), 0.5);
  const toolCentre = vec3.of(
    (tool.x[0] + tool.x[1]) / 2,
    (tool.y[0] + tool.y[1]) / 2,
    (tool.z[0] + tool.z[1]) / 2,
  );

  const pieces: Array<{ piece: PlaneRect; meta: PieceMeta }> = [];

  // Take the tool out of every face of the shell. The pushed face is covered entirely and vanishes;
  // a larger face it sat inside becomes the ring around the opening; untouched faces pass through.
  for (const rectangle of box.rectangles) {
    const cut = toolRectInPlane(tool, rectangle.axis, rectangle.value);
    if (!cut) {
      pieces.push({ piece: rectangle, meta: { reference: boxCentre, toward: false } });
      continue;
    }
    for (const remainder of rect.subtract(rectangle, cut)) {
      pieces.push({ piece: remainder, meta: { reference: boxCentre, toward: false } });
    }
  }

  // Add the tool's own faces that end up strictly inside the shell: the walls of the opening, and
  // its floor when the cut does not pass right through. A face on a shell side is skipped, or the
  // result would carry two coincident faces.
  for (const toolAxis of AXES) {
    for (const side of [0, 1] as const) {
      const value = tool[toolAxis][side];
      if (value <= box.min[toolAxis] + EPS.MERGE || value >= box.max[toolAxis] - EPS.MERGE) continue;
      const [tu, tv] = rect.inPlaneAxes(toolAxis);
      pieces.push({
        piece: {
          axis: toolAxis,
          value,
          uMin: tool[tu][0],
          uMax: tool[tu][1],
          vMin: tool[tv][0],
          vMax: tool[tv][1],
        },
        meta: { reference: toolCentre, toward: true },
      });
    }
  }

  // Subdividing the faces subdivides the edges they share with their neighbours; the neighbours
  // must carry the same subdivision or the shell has T-junctions and no longer closes.
  const conformed = conformRects(pieces);

  if (conformed.length === 0) return { kind: "refuse", error: "Nothing left after the cut" };

  return { kind: "cut", remove: removalClosure(doc, shell), add: rebuild(doc, conformed) };
}

/**
 * Everything that has to go for the shell's faces to go.
 *
 * An edge goes when every face that uses it is going; a point goes when everything that uses it is
 * going. The distinction matters at the boundary: a sketch edge hanging off a shell corner survives
 * the cut, because its far end is not part of the solid. The command's own closure still runs on
 * top, which is what removes an edge whose two ends both go.
 */
function removalClosure(doc: DocumentState, shell: FaceEntity[]): EntityId[] {
  const goingFaces = new Set(shell.map((face) => face.id));
  const remove: EntityId[] = [...goingFaces];

  for (const edge of edgesOf(doc)) {
    const owners = facesOf(doc).filter((face) => {
      for (let index = 0; index < face.points.length; index += 1) {
        const a = face.points[index];
        const b = face.points[(index + 1) % face.points.length];
        if (
          (a === edge.points[0] && b === edge.points[1]) ||
          (a === edge.points[1] && b === edge.points[0])
        ) {
          return true;
        }
      }
      return false;
    });
    if (owners.length > 0 && owners.every((face) => goingFaces.has(face.id))) remove.push(edge.id);
  }

  const going = new Set(remove);
  for (const point of pointsOf(doc)) {
    const users = [
      ...edgesOf(doc).filter((edge) => edge.points.includes(point.id)),
      ...facesOf(doc).filter((face) => face.points.includes(point.id)),
    ];
    if (users.length > 0 && users.every((entity) => going.has(entity.id))) remove.push(point.id);
  }

  return remove;
}