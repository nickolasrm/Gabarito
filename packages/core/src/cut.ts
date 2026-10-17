import { EPS, poly, rect, solidReady, sweepShell, vec3 } from "@gabarito/geometry";
import type { Axis, Bounds, PlaneRect, ShellFace, SolidMesh, Vec3 } from "@gabarito/geometry";
import { allocId, edgesOf, faceHoles, facePositions, facesOf, pointsOf } from "./document";
import type { DocumentState, Entity, EntityId, FaceEntity } from "./types";

/** Entities to remove and add, applied as one transaction so undo is one step. */
export type CutPlan =
  /** Material removed: the sweep hit the solid (decision 0025). */
  | { kind: "cut"; remove: EntityId[]; add: Entity[] }
  /** Material added: the sweep missed the solid, so the prism merges with it. */
  | { kind: "add"; remove: EntityId[]; add: Entity[] }
  /** No solid at all: the prism is built in face soup, the behaviour push/pull always had. */
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
 * The shell as the solid's true surface: markings dropped, every remaining loop an axis-aligned
 * rectangle.
 *
 * A face drawn **on** a coplanar larger face is a marking — the solid's boundary at that plane is
 * the larger face's region — so it is skipped in the mesh input and the cut replaces it with the
 * opening it created (decision 0024). Anything not rectilinear is refused rather than cut
 * approximately: a wrong solid corrupts snapping and every later cut.
 */
function asShellLoops(doc: DocumentState, faces: FaceEntity[]): ShellFace[] | null {
  const dropped = new Set<EntityId>();
  for (const face of faces) {
    const mine = rect.fromPolygon(facePositions(doc, face));
    if (!mine) return null;
    for (const other of faces) {
      if (other.id === face.id || dropped.has(other.id)) continue;
      const theirs = rect.fromPolygon(facePositions(doc, other));
      if (!theirs || theirs.axis !== mine.axis || Math.abs(theirs.value - mine.value) > EPS.MERGE) continue;
      // The other face covers this one: this face is the marking on the other's surface.
      if (
        mine.uMin >= theirs.uMin - EPS.MERGE &&
        mine.uMax <= theirs.uMax + EPS.MERGE &&
        mine.vMin >= theirs.vMin - EPS.MERGE &&
        mine.vMax <= theirs.vMax + EPS.MERGE
      ) {
        dropped.add(face.id);
        break;
      }
    }
  }

  const loops: ShellFace[] = [];
  for (const face of faces) {
    if (dropped.has(face.id)) continue;
    const holes: Vec3[][] = [];
    for (const hole of faceHoles(doc, face)) {
      if (!rect.fromPolygon(hole)) return null;
      holes.push(hole);
    }
    if (!rect.fromPolygon(facePositions(doc, face))) return null;
    loops.push({ outer: facePositions(doc, face), holes });
  }
  return loops;
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
    // On one of the four edges: an edge-midpoint sits on one range, a corner on both.
    const onU = Math.abs(point[u] - uMin) <= EPS.MERGE || Math.abs(point[u] - uMax) <= EPS.MERGE;
    const onV = Math.abs(point[v] - vMin) <= EPS.MERGE || Math.abs(point[v] - vMax) <= EPS.MERGE;
    if (!onU && !onV) return false;
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
 * kernel's own winding. One loop is a face; more are a face with that many holes
 * ([decision 0023](../../docs/decisions/0023-faces-hold-holes.md)) — the ring an opening leaves, and
 * any further openings cut into it. There is no limit to how many a face holds.
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

    // One plane can hold several regions — two tunnel mouths' walls, coplanar but separate — and a
    // region with holes, however many, is one face (decision 0023). Largest first, so each loop
    // lands either as a region's outer or as a hole of the smallest region that contains it.
    const areaOf = (loop: Vec3[]): number => {
      const [u, v] = rect.inPlaneAxes(axis);
      const pts = loop.map((p) => ({ x: p[u], y: p[v] }));
      let sum = 0;
      for (let index = 0; index < pts.length; index += 1) {
        sum += pts[index].x * pts[(index + 1) % pts.length].y - pts[(index + 1) % pts.length].x * pts[index].y;
      }
      return Math.abs(sum / 2);
    };
    const spans = (outer: Vec3[], loop: Vec3[]): boolean => {
      const [u, v] = rect.inPlaneAxes(axis);
      const outerMinU = Math.min(...outer.map((p) => p[u]));
      const outerMaxU = Math.max(...outer.map((p) => p[u]));
      const outerMinV = Math.min(...outer.map((p) => p[v]));
      const outerMaxV = Math.max(...outer.map((p) => p[v]));
      return (
        loop.every((p) => p[u] >= outerMinU - EPS.MERGE) &&
        loop.every((p) => p[u] <= outerMaxU + EPS.MERGE) &&
        loop.every((p) => p[v] >= outerMinV - EPS.MERGE) &&
        loop.every((p) => p[v] <= outerMaxV + EPS.MERGE)
      );
    };
    const regions: FaceLoops[] = [];
    for (const loop of [...loops].sort((a, b) => areaOf(b) - areaOf(a))) {
      const host = regions
        .filter((region) => spans(region.outer, loop))
        .sort((a, b) => areaOf(a.outer) - areaOf(b.outer))[0];
      if (host) host.holes.push(loop);
      else regions.push({ outer: loop, holes: [] });
    }
    faces.push(...regions);
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
 * Plan pushing a face: material removed when the sweep hits material (`cut`), material added when
 * the sweep is empty (`add` — the prism merges with the solid through the kernel), and the plain
 * face extrusion when there is no solid at all (`extrude`).
 *
 * The sweep lands on the side the drag points to, whatever the face's winding (decision 0025). A
 * face that is not a rectangle, or a solid that is not made of them, is refused with a message and
 * the document is left alone.
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
  // No closed surface around the face: material is added, exactly as before this feature.
  if (shell.length === 0) return { kind: "extrude" };

  // A sheet has no inside — every face in one plane — so the drag adds material rather than cutting
  // into a surface with no volume behind it.
  const points = shell.flatMap((face) => facePositions(doc, face));
  const span = (axis: Axis): number =>
    Math.max(...points.map((p) => p[axis])) - Math.min(...points.map((p) => p[axis]));
  if (span("x") <= EPS.MERGE || span("y") <= EPS.MERGE || span("z") <= EPS.MERGE) {
    return { kind: "extrude" };
  }

  if (!solidReady()) {
    return { kind: "refuse", error: "The geometry engine is still loading — try again in a moment" };
  }

  const shellLoops = asShellLoops(doc, shell);
  if (!shellLoops) {
    return { kind: "refuse", error: "Straight cuts need a solid of axis-aligned rectangular faces" };
  }

  const axis = pushed.axis;
  const [u, v] = rect.inPlaneAxes(axis);
  const start = pushed.value;
  // The sweep lands on the side the drag points to — the side the preview shows — which is the
  // face's winding direction, not always the axis's positive side (decision 0025).
  const winding = poly.normal(facePositions(doc, entity));
  const sign = winding && winding[axis] >= 0 ? 1 : -1;
  const end = start + sign * distance;
  const low: Record<Axis, number> = { x: 0, y: 0, z: 0 };
  const high: Record<Axis, number> = { x: 0, y: 0, z: 0 };
  low[axis] = Math.min(start, end);
  high[axis] = Math.max(start, end);
  low[u] = pushed.uMin;
  high[u] = pushed.uMax;
  low[v] = pushed.vMin;
  high[v] = pushed.vMax;
  const tool: Bounds = { min: vec3.of(low.x, low.y, low.z), max: vec3.of(high.x, high.y, high.z) };

  // Material in the sweep decides cut against add; both replace the shell the walk found.
  let swept: { verb: "cut" | "add"; mesh: SolidMesh };
  try {
    swept = sweepShell(shellLoops, tool);
  } catch (error) {
    return { kind: "refuse", error: error instanceof Error ? error.message : "The cut failed" };
  }

  let faces: FaceLoops[];
  try {
    faces = meshToFaces(swept.mesh);
  } catch (error) {
    return { kind: "refuse", error: error instanceof Error ? error.message : "The cut failed" };
  }

  if (faces.length === 0) return { kind: "refuse", error: "Nothing left after the cut" };

  return { kind: swept.verb, remove: removalClosure(doc, shell), add: rebuild(doc, faces) };
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
