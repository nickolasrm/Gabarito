import { EPS, poly as polyOps } from "@gabarito/geometry";
import { allocId, edgesOf, getPoint } from "./document";
import type { DocumentState, EdgeEntity, EntityId, FaceEntity } from "./types";

/** Longest loop we will consider when closing a face. Keeps the search bounded. */
const MAX_LOOP_POINTS = 12;
const MAX_CANDIDATE_LOOPS = 12;

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
 * Simple paths from `start` to `end` that do not use the direct step between them,
 * which is the candidate edge itself. A loop therefore needs at least three points.
 */
function findLoopCandidates(adjacency: Adjacency, start: EntityId, end: EntityId): EntityId[][] {
  const results: EntityId[][] = [];
  const path: EntityId[] = [start];
  const visited = new Set<EntityId>([start]);

  const walk = (node: EntityId): void => {
    if (results.length >= MAX_CANDIDATE_LOOPS || path.length > MAX_LOOP_POINTS) return;
    for (const next of adjacency.get(node) ?? []) {
      if (next === end) {
        if (path.length >= 3) results.push([...path, end]);
        if (results.length >= MAX_CANDIDATE_LOOPS) return;
        continue;
      }
      if (visited.has(next)) continue;
      visited.add(next);
      path.push(next);
      walk(next);
      path.pop();
      visited.delete(next);
      if (results.length >= MAX_CANDIDATE_LOOPS) return;
    }
  };

  walk(start);
  return results;
}

function hasFaceWithLoop(doc: DocumentState, loop: EntityId[]): boolean {
  const wanted = [...loop].sort().join("|");
  for (const entity of Object.values(doc.entities)) {
    if (entity.kind !== "face") continue;
    if ([...entity.points].sort().join("|") === wanted) return true;
  }
  return false;
}

/**
 * A closed, planar loop of edges becomes a face. Called with the edge that was just drawn,
 * because it is not in the document yet.
 */
export function detectFace(doc: DocumentState, candidate: EdgeEntity): FaceEntity | null {
  const start = candidate.points[0];
  const end = candidate.points[1];
  if (start === end) return null;

  const adjacency = buildAdjacency([...edgesOf(doc), candidate]);
  const candidates = findLoopCandidates(adjacency, start, end).sort((a, b) => a.length - b.length);

  for (const loop of candidates) {
    if (new Set(loop).size !== loop.length) continue;
    if (hasFaceWithLoop(doc, loop)) continue;
    const positions = loop.map((id) => getPoint(doc, id));
    if (positions.some((position) => position === null)) continue;
    const points = positions as NonNullable<(typeof positions)[number]>[];
    const normal = polyOps.normal(points);
    if (!normal) continue;
    if (!polyOps.isPlanar(points, EPS.MERGE)) continue;
    if (polyOps.area(points) <= EPS.MERGE) continue;
    return { id: allocId(doc, "f"), kind: "face", points: loop };
  }

  return null;
}
