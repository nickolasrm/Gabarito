import {
  EPS,
  sub,
  cross,
  dot,
  length,
  normal,
  canonicalPlane,
  planeKey,
  near,
  finite,
  onPlane,
  splitSegments,
  regions,
  project,
  inside,
  triangulate,
} from "@gabarito/geometry";
import type { Vec3, Plane, Surface, Segment, Mesh } from "@gabarito/geometry";
export interface Vertex {
  id: string;
  kind: "vertex";
  position: Vec3;
}
export interface Edge {
  id: string;
  kind: "edge";
  vertices: [string, string];
}
export interface Face {
  id: string;
  kind: "face";
  outer: string[];
  holes: string[][];
}
export type Entity = Vertex | Edge | Face;
export interface Model {
  entities: Record<string, Entity>;
  selection: string[];
  erased: string[];
  nextId: number;
  revision: number;
}
export const createModel = (): Model => ({
  entities: {},
  selection: [],
  erased: [],
  nextId: 1,
  revision: 0,
});
export const vertices = (m: Model): Vertex[] =>
  Object.values(m.entities).filter((e): e is Vertex => e.kind === "vertex");
export const edges = (m: Model): Edge[] =>
  Object.values(m.entities).filter((e): e is Edge => e.kind === "edge");
export const faces = (m: Model): Face[] =>
  Object.values(m.entities).filter((e): e is Face => e.kind === "face");
export const position = (m: Model, id: string): Vec3 => {
  const e = m.entities[id];
  if (e?.kind !== "vertex") throw new Error("Missing vertex");
  return e.position;
};
export const loops = (f: Face): string[][] => [f.outer, ...f.holes];
export const surface = (m: Model, f: Face): Surface => ({
  outer: f.outer.map((id) => position(m, id)),
  holes: f.holes.map((l) => l.map((id) => position(m, id))),
});
export const facePlane = (m: Model, f: Face): Plane =>
  canonicalPlane(
    position(m, f.outer[0]),
    normal(f.outer.map((id) => position(m, id))),
  );
export const alloc = (m: Model, prefix: string): string => prefix + m.nextId++;
export const edgeKey = (a: string, b: string): string =>
  [a, b].sort().join(":");
export const loopKey = (ids: string[]): string =>
  ids
    .map((_, i) => [...ids.slice(i), ...ids.slice(0, i)].join(":"))
    .concat(
      [...ids]
        .reverse()
        .map((_, i, a) => [...a.slice(i), ...a.slice(0, i)].join(":")),
    )
    .sort()[0];
export const faceKey = (f: Pick<Face, "outer" | "holes">): string =>
  loopKey(f.outer) + "/" + f.holes.map(loopKey).sort().join("/");
export function weld(m: Model, p: Vec3): string {
  const old = vertices(m).find((v) => near(v.position, p));
  if (old) return old.id;
  const id = alloc(m, "v");
  m.entities[id] = { id, kind: "vertex", position: { ...p } };
  return id;
}
export function addEdge(m: Model, a: string, b: string): void {
  if (a === b) return;
  if (edges(m).some((e) => edgeKey(...e.vertices) === edgeKey(a, b))) return;
  const id = alloc(m, "e");
  m.entities[id] = { id, kind: "edge", vertices: [a, b] };
}
export function addSurface(m: Model, s: Surface): void {
  const outer = s.outer.map((p) => weld(m, p)),
    holes = s.holes.map((l) => l.map((p) => weld(m, p)));
  for (const loop of [outer, ...holes])
    loop.forEach((a, i) => addEdge(m, a, loop[(i + 1) % loop.length]));
  const f: Face = { id: alloc(m, "f"), kind: "face", outer, holes };
  if (!faces(m).some((old) => faceKey(old) === faceKey(f)))
    m.entities[f.id] = f;
}
function candidatePlanes(m: Model): Plane[] {
  const planes = new Map<string, Plane>();
  for (const f of faces(m)) {
    const p = facePlane(m, f);
    planes.set(planeKey(p), p);
  }
  const adjacent = new Map<string, string[]>();
  for (const e of edges(m)) {
    const [a, b] = e.vertices;
    adjacent.set(a, [...(adjacent.get(a) ?? []), b]);
    adjacent.set(b, [...(adjacent.get(b) ?? []), a]);
  }
  for (const [a, list] of adjacent)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const p = position(m, a),
          n = cross(sub(position(m, list[i]), p), sub(position(m, list[j]), p));
        if (length(n) > EPS) {
          const f = canonicalPlane(p, n);
          planes.set(planeKey(f), f);
        }
      }
  return [...planes.values()];
}
export function rebuildFaces(m: Model, only?: Plane[]): void {
  for (const f of only ?? candidatePlanes(m)) {
    const old = faces(m).filter((face) =>
      loops(face)
        .flat()
        .every((id) => onPlane(position(m, id), f)),
    );
    const oldByKey = new Map(old.map((face) => [faceKey(face), face]));
    for (const face of old) delete m.entities[face.id];
    const points = vertices(m),
      indices = new Map(points.map((p, i) => [p.id, i]));
    const inPlane = edges(m)
      .filter((e) => e.vertices.every((id) => onPlane(position(m, id), f)))
      .map((e) => e.vertices.map((id) => indices.get(id)!) as [number, number]);
    for (const region of regions(
      points.map((v) => v.position),
      inPlane,
      f,
    )) {
      const outer = region.outer.map((i) => points[i].id),
        holes = region.holes.map((l) => l.map((i) => points[i].id));
      const key = faceKey({ outer, holes });
      if (m.erased.includes(key)) continue;
      const previous = oldByKey.get(key),
        id = previous?.id ?? alloc(m, "f");
      let result: Face = { id, kind: "face", outer, holes };
      // Preserve a solid's outward orientation when its planar surface is subdivided.
      const ancestor = old.find((face) => {
        const s = surface(m, face),
          xy = s.outer.map((p) => project(p, f));
        return outer.every((id) => inside(project(position(m, id), f), xy));
      });
      if (
        ancestor &&
        dot(normal(ancestor.outer.map((id) => position(m, id))), f.normal) < 0
      )
        result = {
          ...result,
          outer: [...outer].reverse(),
          holes: holes.map((l) => [...l].reverse()),
        };
      m.entities[id] = result;
    }
  }
}
export function draw(m: Model, segments: Segment[]): void {
  for (const [a, b] of segments)
    if (!finite(a) || !finite(b) || near(a, b))
      throw new Error("Draw a nonzero finite edge");
  const originalEdges = edges(m),
    all: Segment[] = [
      ...originalEdges.map(
        (e) => e.vertices.map((id) => position(m, id)) as Segment,
      ),
      ...segments,
    ];
  const split = splitSegments(all),
    ids = split.points.map((p) => weld(m, p));
  const desired = new Set(split.edges.map(([a, b]) => edgeKey(ids[a], ids[b])));
  // Update old face loops before replacing subdivided edges, including adjacent non-drawing planes.
  for (const face of faces(m))
    for (const loop of loops(face)) {
      const updated: string[] = [];
      for (let i = 0; i < loop.length; i++) {
        const a = position(m, loop[i]),
          b = position(m, loop[(i + 1) % loop.length]),
          d = sub(b, a),
          size = dot(d, d);
        const middle = vertices(m)
          .map((v) => ({
            id: v.id,
            p: v.position,
            t: dot(sub(v.position, a), d) / size,
          }))
          .filter(
            (v) =>
              v.t > EPS &&
              v.t < 1 - EPS &&
              length(cross(sub(v.p, a), d)) < EPS * length(d),
          )
          .sort((a, b) => a.t - b.t);
        updated.push(loop[i], ...middle.map((v) => v.id));
      }
      loop.splice(0, loop.length, ...updated);
    }
  for (const e of originalEdges)
    if (!desired.has(edgeKey(...e.vertices))) delete m.entities[e.id];
  for (const [a, b] of split.edges) addEdge(m, ids[a], ids[b]);
  const planes = candidatePlanes(m).filter((f) =>
    segments.some((s) => s.every((p) => onPlane(p, f))),
  );
  rebuildFaces(m, planes);
  m.selection = m.selection.filter((id) => !!m.entities[id]);
}
export function selectedVertices(m: Model, ids: string[]): Set<string> {
  const result = new Set<string>();
  for (const id of ids) {
    const e = m.entities[id];
    if (e?.kind === "vertex") result.add(id);
    if (e?.kind === "edge") e.vertices.forEach((id) => result.add(id));
    if (e?.kind === "face")
      loops(e)
        .flat()
        .forEach((id) => result.add(id));
  }
  return result;
}
export function meshOfModel(m: Model, fs = faces(m)): Mesh {
  const points: Vec3[] = [],
    triangles: number[] = [];
  for (const f of fs) {
    const mesh = triangulate(surface(m, f)),
      offset = points.length;
    points.push(...mesh.points);
    triangles.push(...mesh.triangles.map((i) => i + offset));
  }
  return { points, triangles };
}
export function validate(m: Model): void {
  const keys = new Set<string>();
  for (const v of vertices(m))
    if (!finite(v.position)) throw new Error("Coordinates must be finite");
  for (const e of edges(m)) {
    const [a, b] = e.vertices,
      key = edgeKey(a, b);
    if (near(position(m, a), position(m, b)) || keys.has(key))
      throw new Error("Duplicate or zero-length edge");
    keys.add(key);
  }
  const faceKeys = new Set<string>();
  for (const f of faces(m)) {
    const s = surface(m, f),
      n = normal(s.outer),
      p = canonicalPlane(s.outer[0], n);
    if (length(n) < EPS) throw new Error("A face needs a nonzero area");
    for (const loop of loops(f)) {
      if (loop.length < 3 || new Set(loop).size !== loop.length)
        throw new Error("Invalid face loop");
      loop.forEach((a, i) => {
        if (!keys.has(edgeKey(a, loop[(i + 1) % loop.length])))
          throw new Error("Face boundary is missing an edge");
        if (!onPlane(position(m, a), p))
          throw new Error("Transform would make a nonplanar face");
      });
    }
    for (const loop of [s.outer, ...s.holes]) {
      const split = splitSegments(
        loop.map((a, i) => [a, loop[(i + 1) % loop.length]]),
      );
      if (
        split.points.length !== loop.length ||
        split.edges.length !== loop.length
      )
        throw new Error("Transform would make a self-intersecting face");
    }
    for (const hole of s.holes)
      if (
        !hole.every((v) =>
          inside(
            project(v, p),
            s.outer.map((v) => project(v, p)),
            false,
          ),
        )
      )
        throw new Error("A face hole must stay inside its boundary");
    const key = faceKey(f);
    if (faceKeys.has(key)) throw new Error("Duplicate face");
    faceKeys.add(key);
    triangulate(s);
  }
}
