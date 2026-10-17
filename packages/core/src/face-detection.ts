import { EPS, poly as polyOps } from "@gabarito/geometry";
import { allocId, edgesOf, getPoint } from "./document";
import type { DocumentState, EdgeEntity, EntityId, FaceEntity, Vec3 } from "./types";

/** Bound for the fallback search only. The main search is a breadth-first shortest cycle. */
const MAX_FALLBACK_POINTS = 256;
const MAX_FALLBACK_RESULTS = 8;
const MAX_FALLBACK_STEPS = 20_000;

type Adjacency = Map<EntityId, Set<EntityId>>;

function buildAdjacency(edges: EdgeEntity[]): Adjacency {
  const adjacency: Adjacency = new Map();
  const link = (a: EntityId, b: EntityId) => {
    let set = adjacency.get(a);
    if (!set) {
      set = new Set();
      adjacency.set(a, set);
    }
    set.add(b);
  };
  for (const edge of edges) {
    link(edge.points[0], edge.points[1]);
    link(edge.points[1], edge.points[0]);
  }
  return adjacency;
}

/**
 * Shortest simple path from `start` to `end` that does not take the direct step between
 * them, which is the candidate edge itself. A loop therefore has at least three points.
 *
 * Breadth-first, so the result is the smallest cycle through the new edge and unrelated
 * geometry elsewhere in the document cannot starve it the way a capped depth-first walk
 * could.
 */
function shortestCycle(adjacency: Adjacency, start: EntityId, end: EntityId): EntityId[] | null {
  const previous = new Map<EntityId, EntityId | null>([[start, null]]);
  const queue: EntityId[] = [start];

  while (queue.length > 0) {
    const node = queue.shift() as EntityId;
    for (const next of adjacency.get(node) ?? []) {
      if (previous.has(next)) continue;
      if (node === start && next === end) continue;
      previous.set(next, node);
      if (next === end) {
        const path: EntityId[] = [];
        let cursor: EntityId | null = end;
        while (cursor) {
          path.unshift(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path.length >= 3 ? path : null;
      }
      queue.push(next);
    }
  }

  return null;
}

/** Longer loops, in case the smallest cycle through the edge is not planar. Validated as it goes. */
function otherCycles(
  adjacency: Adjacency,
  start: EntityId,
  end: EntityId,
  accept: (loop: EntityId[]) => boolean,
): EntityId[][] {
  const found: EntityId[][] = [];
  const path: EntityId[] = [start];
  const visited = new Set<EntityId>([start]);
  let steps = 0;

  const walk = (node: EntityId): void => {
    if (steps > MAX_FALLBACK_STEPS || found.length >= MAX_FALLBACK_RESULTS) return;
    if (path.length > MAX_FALLBACK_POINTS) return;
    for (const next of adjacency.get(node) ?? []) {
      steps += 1;
      if (steps > MAX_FALLBACK_STEPS) return;
      if (next === end) {
        if (path.length >= 2) {
          const loop = [...path, end];
          // Validate during the walk: junk paths must not consume the budget that a
          // valid loop needs.
          if (accept(loop)) found.push(loop);
        }
        continue;
      }
      if (visited.has(next)) continue;
      visited.add(next);
      path.push(next);
      walk(next);
      path.pop();
      visited.delete(next);
      if (found.length >= MAX_FALLBACK_RESULTS) return;
    }
  };

  walk(start);
  return found.sort((a, b) => a.length - b.length);
}

function positionsOf(doc: DocumentState, loop: EntityId[]): Vec3[] | null {
  const out: Vec3[] = [];
  for (const id of loop) {
    const position = getPoint(doc, id);
    if (!position) return null;
    out.push(position);
  }
  return out;
}

function hasFaceWithLoop(doc: DocumentState, loop: EntityId[]): boolean {
  const wanted = [...loop].sort().join("|");
  for (const entity of Object.values(doc.entities)) {
    if (entity.kind !== "face") continue;
    if ([...entity.points].sort().join("|") === wanted) return true;
  }
  return false;
}

function validLoop(doc: DocumentState, loop: EntityId[]): boolean {
  if (new Set(loop).size !== loop.length) return false;
  if (hasFaceWithLoop(doc, loop)) return false;
  const positions = positionsOf(doc, loop);
  if (!positions) return false;
  if (!polyOps.normal(positions)) return false;
  if (!polyOps.isPlanar(positions, EPS.MERGE)) return false;
  return polyOps.area(positions) > EPS.MERGE;
}

/**
 * A closed, planar loop of edges becomes a face. Called with the edge that was just drawn,
 * because it is not in the document yet.
 */
export function detectFaces(doc: DocumentState, candidate: EdgeEntity): FaceEntity[] {
  const start = candidate.points[0];
  const end = candidate.points[1];
  if (start === end) return [];

  const adjacency = buildAdjacency([...edgesOf(doc), candidate]);
  const loops: EntityId[][] = [];

  // One edge can close several loops at once — think of a diagonal dropped into a square,
  // which closes a triangle on either side. Every one of them is a face.
  const smallest = shortestCycle(adjacency, start, end);
  if (smallest && validLoop(doc, smallest)) loops.push(smallest);
  for (const loop of otherCycles(adjacency, start, end, (candidateLoop) => validLoop(doc, candidateLoop))) {
    if (!loops.some((existing) => existing.join("|") === loop.join("|"))) loops.push(loop);
  }

  return loops.map((points) => ({ id: allocId(doc, "f"), kind: "face", points }));
}
