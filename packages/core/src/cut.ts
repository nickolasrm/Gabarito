import { EPS, rect, solidReady, subtractSolid, vec3 } from "@gabarito/geometry";
import type { Axis, Bounds, PlaneRect, SolidMesh, Vec3 } from "@gabarito/geometry";
import { allocId, edgesOf, facePositions, facesOf, pointsOf } from "./document";
import type { DocumentState, Entity, EntityId, FaceEntity } from "./types";

/** Entities to remove and add, applied as one transaction so undo is one step. */
export type CutPlan =
  | { kind: "cut"; remove: EntityId[]; add: Entity[] }
  /** The drag points away from any solid, so material is added: the behaviour push/pull always had. */
  | { kind: "extrude" }
  /** Straight cuts have limits, and a refusal beats a wrong solid (decision 0022). */
  | { kind: "refuse"; error: string };

function loopPairKeys(face: FaceEntity): string[] {
  const keys: string[] = [];
  for (const loop of [face.points, ...(face.holes ?? [])]) {
    for (let index = 0; index < loop.length; index += 1) {
      const a = loop[index];
      const b = loop[(index + 1) % loop.length];
      keys.push(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
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

/**
 * Read a shell as an axis-aligned box, or nothing.
 *
 * Anything else is refused rather than cut approximately: a wrong solid corrupts snapping and every
 * later cut (decision 0022). The kernel only ever subtracts boxes, so this check is also what keeps
 * the input manifold by construction.
 */
function asAxisAlignedBox(doc: DocumentState, faces: FaceEntity[]): (Bounds & { faces: FaceEntity[] }) | null {
  if (faces.length < 6) return null;
  for (const face of faces) {
    if (!rect.fromPolygon(facePositions(doc, face))) return null;
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

  // Every face must lie on one of the box's six sides and stay within the box otherwise.
  for (const face of faces) {
    const rectangle = rect.fromPolygon(facePositions(doc, face)) as PlaneRect;
    const value = rectangle.value;
    if (Math.abs(value - min[rectangle.axis]) > EPS.MERGE && Math.abs(value - max[rectangle.axis]) > EPS.MERGE) {
      return null;
    }
    const [u, v] = rect.inPlaneAxes(rectangle.axis);
    if (rectangle.uMin < min[u] - EPS.MERGE || rectangle.uMax > max[u] + EPS.MERGE) return null;
    if (rectangle.vMin < min[v] - EPS.MERGE || rectangle.vMax > max[v] + EPS.MERGE) return null;
  }
  return { min, max, faces };
}

const keyOf = (point: Vec3): string =>
  `${Math.round(point.x / 1e-3)},${Math.round(point.y / 1e-3)},${Math.round(point.z / 1e-3)}`;

/** The welded vertex a kernel vertex maps to, merging coincident float32 coordinates. */
function weld(mesh: SolidMesh): { verts: Vec3[]; ids: Map<number, number> } {
  const keys = new Map<string, number>();
  const verts: Vec3[] = [];
  const ids = new Map<number, number>();
  for (let index = 0; index < mesh.positions.length; index += 1) {
    const key = keyOf(mesh.positions[index]);
    let id = keys.get(key);
    if (id === undefined) {
      id = verts.push(mesh.positions[index]) - 1;
      keys.set(key, id);
    }
    ids.set(index, id);
  }
  return { verts, ids };
}

/** Whether every point of the loop lies on its bounding rectangle: the loop bounds an axis-aligned rectangle. */
function isRectangular(loop: Vec3[], axis: Axis): boolean {
  const [u, v] = rect.inPlaneAxes(axis);
  const uMin = Math.min(...loop.map((p) => p[u]));
  const uMax = Math.max(...loop.map((p) => p[u]));
  const vMin = Math.min(...loop.map((p) => p[v]));
  const vMax = Math.max(...loop.map((p) => p[v]));
  for (const point of loop) {
    if (Math.abs(point[u] - uMin) > EPS.MERGE && Math.abs(point[u] - uMax) > EPS.MERGE) return false;
    if (Math.abs(point[v] - vMin) > EPS.MERGE && Math.abs(point[v] - vMax) > EPS.MERGE) return false;
  }
  return true;
}

/** A face loop as the document holds it: the kernel's outer loop, plus one loop per hole. */
interface FaceLoops {
  outer: Vec3[];
  holes: Vec3[][];
}

/**
 * The kernel mesh as faces the document can hold.
 *
 * Coplanar triangles group into a face; each group's once-used edges form its boundary loops, in the
 * kernel's own winding. One loop is a face; two are a face with a hole
 * ([decision 0023](../../docs/decisions/0023-faces-hold-holes.md)) — the ring an opening leaves in
 * the face it was cut from. Anything else is refused — the input is two boxes, so anything else
 * means the conversion is wrong.
 */
function meshToFaces(mesh: SolidMesh): FaceLoops[] {
  const { verts, ids } = weld(mesh);
  const tris: Array<[number, number, number]> = [];
  for (let index = 0; index + 2 < mesh.triangles.length; index += 3) {
    const a = ids.get(mesh.triangles[index]) as number;
    const b = ids.get(mesh.triangles[index + 1]) as number;
    const c = ids.get(mesh.triangles[index + 2]) as number;
    if (a !== b && b !== c && a !== c) tris.push([a, b, c]);
  }

  const groups = new Map<string, Array<[number, number, number]>>();
  for (const [a, b, c] of tris) {
    const n = vec3.cross(vec3.sub(verts[b], verts[a]), vec3.sub(verts[c], verts[a]));
    const axis: Axis =
      Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? "x" : Math.abs(n.y) >= Math.abs(n.z) ? "y" : "z";
    const value = verts[a][axis];
    if (Math.abs(verts[b][axis] - value) > EPS.MERGE || Math.abs(verts[c][axis] - value) > EPS.MERGE) {
      throw new Error("The cut kernel produced a face that is not axis-aligned");
    }
    const key = `${axis}:${Math.round(value / 1e-3)}`;
    const group = groups.get(key) ?? [];
    group.push([a, b, c]);
    groups.set(key, group);
  }

  const faces: FaceLoops[] = [];
  for (const [key, group] of groups) {
    const axis = key.split(":")[0] as Axis;
    // Directed edge uses within the group: an interior edge runs once each way, a boundary edge
    // once. Kernel winding is consistent, so boundary direction carries the face's normal.
    const use = new Map<string, number>();
    for (const [a, b, c] of group) {
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const edge = `${p}>${q}`;
        use.set(edge, (use.get(edge) ?? 0) + 1);
      }
    }
    const next = new Map<number, number>();
    for (const [edge, forward] of use) {
      const [p, q] = edge.split(">").map(Number);
      if ((use.get(`${q}>${p}`) ?? 0) === 1) {
        if (forward !== 1) throw new Error("The cut kernel produced a self-overlapping face");
        continue;
      }
      if (forward !== 1) throw new Error("The cut kernel produced a self-overlapping face");
      if (next.has(p)) throw new Error("The cut kernel produced a pinched face boundary");
      next.set(p, q);
    }

    const raw: Vec3[][] = [];
    while (next.size > 0) {
      const start = next.keys().next().value as number;
      const loop: number[] = [];
      let current = start;
      do {
        loop.push(current);
        const following = next.get(current);
        if (following === undefined) throw new Error("The cut kernel produced an open face boundary");
        next.delete(current);
        current = following;
      } while (current !== start);
      raw.push(loop.map((id) => verts[id]));
    }

    const loops = raw.map((loop) => {
      if (!isRectangular(loop, axis)) {
        throw new Error("The cut kernel produced a face the document cannot hold");
      }
      return loop;
    });

    if (loops.length === 1) {
      faces.push({ outer: loops[0], holes: [] });
      continue;
    }
    if (loops.length === 2) {
      // The ring around the opening. The larger loop bounds the other, which the kernel guarantees
      // for a planar region with one hole.
      const [a, b] = loops;
      const areaOf = (loop: Vec3[]): number => {
        const [u, v] = rect.inPlaneAxes(axis);
        const pts = loop.map((p) => ({ x: p[u], y: p[v] }));
        let sum = 0;
        for (let index = 0; index < pts.length; index += 1) {
          sum += pts[index].x * pts[(index + 1) % pts.length].y - pts[(index + 1) % pts.length].x * pts[index].y;
        }
        return Math.abs(sum / 2);
      };
      faces.push(areaOf(a) >= areaOf(b) ? { outer: a, holes: [b] } : { outer: b, holes: [a] });
      continue;
    }
    throw new Error("The cut kernel produced a face the document cannot hold");
  }
  return faces;
}

/**
 * Build fresh entities from face loops, welding corners between them so the shell stays closed.
 *
 * Winding comes straight from the kernel mesh, which is consistently outward
 * ([decision 0022](../../docs/decisions/0022-cuts-run-on-manifold.md)); a hole loop is stored the way
 * the kernel wound it.
 */
function rebuild(doc: DocumentState, faces: FaceLoops[]): Entity[] {
  const entities: Entity[] = [];
  const pointIds = new Map<string, EntityId>();
  const edgeKeys = new Set<string>();

  const pointAt = (point: Vec3): EntityId => {
    const key = keyOf(point);
    const existing = pointIds.get(key);
    if (existing) return existing;
    const id = allocId(doc, "p");
    pointIds.set(key, id);
    entities.push({ id, kind: "point", position: point });
    return id;
  };

  for (const { outer, holes } of faces) {
    const loops = [outer, ...holes];
    for (const loop of loops) {
      const ids = loop.map(pointAt);
      for (let index = 0; index < ids.length; index += 1) {
        const a = ids[index];
        const b = ids[(index + 1) % ids.length];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        entities.push({ id: allocId(doc, "e"), kind: "edge", points: [a, b] });
      }
    }
    const [outerIds, ...holeIds] = loops.map((loop) => loop.map(pointAt));
    entities.push({
      id: allocId(doc, "f"),
      kind: "face",
      points: outerIds,
      ...(holeIds.length > 0 ? { holes: holeIds } : {}),
    });
  }
  return entities;
}

/**
 * Plan pushing a face: material removed when the drag goes into a solid, material added when it
 * points away — the behaviour push/pull always had, and still the one that applies with no solid
 * to cut.
 *
 * The cut itself is a kernel subtraction of two axis-aligned boxes (decision 0022). A shell that is
 * not an axis-aligned box of rectangles, or a face that is not a rectangle, is refused with a
 * message and the document is left alone.
 */
export function planCut(doc: DocumentState, faceId: EntityId, distance: number): CutPlan {
  const entity = doc.entities[faceId];
  if (!entity || entity.kind !== "face") return { kind: "refuse", error: "Pick a face to push or pull" };
  // A face with a hole pushed along its normal is a prism with a hole — not a straight cut. The
  // opening's floor and walls are the faces to push (decision 0023).
  if (entity.holes?.length) return { kind: "refuse", error: "Push the opening's floor or walls instead" };

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
  // The drag enters the material only from the side the face lies on; from the other side it grows
  // the solid instead of cutting it.
  const atMin = Math.abs(start - box.min[axis]) <= EPS.MERGE;
  const atMax = Math.abs(start - box.max[axis]) <= EPS.MERGE;
  const inward = (atMin && distance > 0) || (atMax && distance < 0);
  if (!inward) return { kind: "extrude" };

  if (!solidReady()) {
    return { kind: "refuse", error: "The geometry engine is still loading — try again in a moment" };
  }

  const end = start + distance;
  const low: Record<Axis, number> = { x: 0, y: 0, z: 0 };
  const high: Record<Axis, number> = { x: 0, y: 0, z: 0 };
  low[axis] = Math.min(start, end);
  high[axis] = Math.max(start, end);
  low[u] = pushed.uMin;
  high[u] = pushed.uMax;
  low[v] = pushed.vMin;
  high[v] = pushed.vMax;
  const tool: Bounds = { min: vec3.of(low.x, low.y, low.z), max: vec3.of(high.x, high.y, high.z) };

  let mesh: SolidMesh;
  try {
    mesh = subtractSolid({ min: box.min, max: box.max }, tool);
  } catch (error) {
    return { kind: "refuse", error: error instanceof Error ? error.message : "The cut failed" };
  }

  let faces: FaceLoops[];
  try {
    faces = meshToFaces(mesh);
  } catch (error) {
    return { kind: "refuse", error: error instanceof Error ? error.message : "The cut failed" };
  }

  if (faces.length === 0) return { kind: "refuse", error: "Nothing left after the cut" };

  return { kind: "cut", remove: removalClosure(doc, shell), add: rebuild(doc, faces) };
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

  /** Every loop of the face, outer first — edges and points are used by any of them (decision 0023). */
  const loopsOf = (face: FaceEntity): EntityId[][] => [face.points, ...(face.holes ?? [])];

  for (const edge of edgesOf(doc)) {
    const owners = facesOf(doc).filter((face) =>
      loopsOf(face).some((loop) => {
        for (let index = 0; index < loop.length; index += 1) {
          const a = loop[index];
          const b = loop[(index + 1) % loop.length];
          if (
            (a === edge.points[0] && b === edge.points[1]) ||
            (a === edge.points[1] && b === edge.points[0])
          ) {
            return true;
          }
        }
        return false;
      }),
    );
    if (owners.length > 0 && owners.every((face) => goingFaces.has(face.id))) remove.push(edge.id);
  }

  const going = new Set(remove);
  for (const point of pointsOf(doc)) {
    const users = [
      ...edgesOf(doc).filter((edge) => edge.points.includes(point.id)),
      ...facesOf(doc).filter((face) => loopsOf(face).some((loop) => loop.includes(point.id))),
    ];
    if (users.length > 0 && users.every((entity) => going.has(entity.id))) remove.push(point.id);
  }

  return remove;
}
