import { unusedComponents, deleteComponent } from "./component-library";
import {
  identity,
  componentName,
  makeComponent,
  mapTransform,
} from "./components";
import { scaleSelection } from "./scale";
import { erase } from "./erase";
import {
  EPS,
  insetContours,
  sub,
  unit,
  add,
  mul,
  dot,
  normal,
  rotate,
  scale,
  finite,
  sweep,
  surfacesOf,
  mergeCoplanar,
} from "@gabarito/geometry";
import type { Vec3, Segment } from "@gabarito/geometry";
import {
  alloc,
  draw,
  conformEdges,
  position,
  edges,
  faces,
  loops,
  surface,
  addSurface,
  selectedVertices,
  edgeKey,
  faceKey,
} from "./model";
import type { Model, Face } from "./model";
export type Command =
  | { type: "delete-component"; definition: string }
  | { type: "purge-components" }
  | { type: "make-component"; ids: string[]; name: string }
  | { type: "rename-component"; definition: string; name: string }
  | { type: "place-component"; definition: string; point: Vec3 }
  | { type: "guide"; origin: Vec3; direction: Vec3 }
  | { type: "draw"; segments: Segment[]; fillLoop?: Vec3[] }
  | { type: "delete"; ids: string[] }
  | { type: "move"; ids: string[]; delta: Vec3 }
  | { type: "rotate"; ids: string[]; center: Vec3; axis: Vec3; angle: number }
  | { type: "scale"; ids: string[]; anchor: Vec3; factors: Vec3 }
  | { type: "pushpull"; face: string; distance: number; direction?: Vec3 }
  | { type: "offset"; face: string; distance: number };
function component(m: Model, seed: Face): Face[] {
  const byEdge = new Map<string, Face[]>();
  for (const f of faces(m))
    for (const l of loops(f))
      l.forEach((a, i) => {
        const key = edgeKey(a, l[(i + 1) % l.length]);
        byEdge.set(key, [...(byEdge.get(key) ?? []), f]);
      });
  const found = [seed],
    seen = new Set([seed.id]);
  for (let i = 0; i < found.length; i++)
    for (const l of loops(found[i]))
      l.forEach((a, j) => {
        for (const next of byEdge.get(edgeKey(a, l[(j + 1) % l.length])) ?? [])
          if (!seen.has(next.id)) {
            seen.add(next.id);
            found.push(next);
          }
      });
  return found;
}
export function isClosed(fs: Face[]): boolean {
  const counts = new Map<string, number>();
  for (const f of fs)
    for (const l of loops(f))
      l.forEach((a, i) => {
        const k = edgeKey(a, l[(i + 1) % l.length]);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });
  return counts.size > 0 && [...counts.values()].every((n) => n === 2);
}
function orient(m: Model, fs: Face[]): void {
  const directed = (f: Face): [string, string][] =>
    loops(f).flatMap((l) =>
      l.map((a, i) => [a, l[(i + 1) % l.length]] as [string, string]),
    );
  const done = new Set<string>();
  const walk = (f: Face) => {
    done.add(f.id);
    for (const [a, b] of directed(f))
      for (const next of fs) {
        if (done.has(next.id)) continue;
        const shared = directed(next).find(
          ([x, y]) => edgeKey(x, y) === edgeKey(a, b),
        );
        if (shared) {
          if (shared[0] === a) {
            next.outer.reverse();
            next.holes.forEach((l) => l.reverse());
          }
          walk(next);
        }
      }
  };
  walk(fs[0]);
  let vol = 0;
  // Boundary-integral volume supports holes; planar loops are fan-integrated with signed winding.
  for (const f of fs)
    for (const l of loops(f))
      for (let i = 1; i < l.length - 1; i++) {
        const a = position(m, l[0]),
          b = position(m, l[i]),
          c = position(m, l[i + 1]);
        vol +=
          (a.x * (b.y * c.z - b.z * c.y) +
            a.y * (b.z * c.x - b.x * c.z) +
            a.z * (b.x * c.y - b.y * c.x)) /
          6;
      }
  if (vol < 0)
    for (const f of fs) {
      f.outer.reverse();
      f.holes.forEach((l) => l.reverse());
    }
}
function extrude(
  m: Model,
  id: string,
  distance: number,
  direction?: Vec3,
): void {
  if (!Number.isFinite(distance) || Math.abs(distance) < EPS)
    throw new Error("Enter a nonzero distance");
  const face = m.entities[id];
  if (face?.kind !== "face") throw new Error("Choose a face");
  const connected = component(m, face),
    closed = isClosed(connected);
  if (closed) orient(m, connected);
  const s = surface(m, face),
    n = normal(s.outer),
    delta = mul(direction ?? n, distance);
  if (Math.abs(dot(n, delta)) < EPS)
    throw new Error("Push/pull direction must leave the face plane");
  const result =
    !closed && connected.length > 1
      ? mergeCoplanar([
          ...connected
            .filter((f) => f.id !== face.id)
            .map((f) => surface(m, f)),
          {
            outer: s.outer.map((p) => add(p, delta)),
            holes: s.holes.map((l) => l.map((p) => add(p, delta))),
          },
          ...[s.outer, ...s.holes].flatMap((loop) =>
            loop.map((a, i) => {
              const b = loop[(i + 1) % loop.length];
              return { outer: [a, b, add(b, delta), add(a, delta)], holes: [] };
            }),
          ),
        ])
      : surfacesOf(
          sweep(
            s,
            delta,
            closed ? connected.map((f) => surface(m, f)) : undefined,
            closed && dot(n, delta) < 0,
          ),
        );
  const removed = new Set(connected.map((f) => f.id));
  const oldVertices = selectedVertices(m, [...removed]);
  for (const key of removed) delete m.entities[key];
  const protectedEdges = new Set(
    faces(m).flatMap((f) =>
      loops(f).flatMap((l) =>
        l.map((a, i) => edgeKey(a, l[(i + 1) % l.length])),
      ),
    ),
  );
  for (const e of edges(m))
    if (
      e.vertices.every((v) => oldVertices.has(v)) &&
      !protectedEdges.has(edgeKey(...e.vertices))
    )
      delete m.entities[e.id];
  const used = new Set(edges(m).flatMap((e) => e.vertices));
  for (const key of oldVertices) if (!used.has(key)) delete m.entities[key];
  for (const patch of result) addSurface(m, patch);
  conformEdges(m);
  // Kernel holes are empty regions, not unfinished edge loops awaiting a face.
  for (const f of faces(m))
    for (const hole of f.holes) {
      if (
        !faces(m).some(
          (other) =>
            faceKey({ outer: other.outer, holes: [] }) ===
            faceKey({ outer: hole, holes: [] }),
        )
      )
        m.erased.push({ outer: [...hole], holes: [] });
    }
  m.selection = [];
}
export function apply(m: Model, c: Command): void {
  if (c.type === "move" || c.type === "rotate" || c.type === "scale") {
    if (
      c.type === "scale" &&
      (!finite(c.factors) ||
        Math.min(c.factors.x, c.factors.y, c.factors.z) <= 0)
    )
      throw new Error("Scale factors must be finite and positive");
    if (
      c.type === "rotate" &&
      (!Number.isFinite(c.angle) ||
        Math.hypot(c.axis.x, c.axis.y, c.axis.z) < EPS)
    )
      throw new Error("Enter a finite angle and a valid axis");
    let transformed = false;
    for (const id of new Set(c.ids)) {
      const e = m.entities[id];
      if (e?.kind !== "component") continue;
      transformed = true;
      e.transform = mapTransform(e.transform, (p) =>
        c.type === "move"
          ? add(p, c.delta)
          : c.type === "rotate"
            ? rotate(p, c.center, c.axis, c.angle)
            : scale(p, c.anchor, c.factors),
      );
    }
    if (
      transformed &&
      c.ids.every((id) => m.entities[id]?.kind === "component")
    )
      return;
  }
  switch (c.type) {
    case "delete-component":
      deleteComponent(m, c.definition);
      break;
    case "purge-components":
      for (const id of unusedComponents(m)) delete m.definitions[id];
      break;
    case "make-component":
      makeComponent(m, c.ids, c.name);
      break;
    case "rename-component": {
      const d = m.definitions[c.definition];
      if (!d) throw new Error("Missing component definition");
      d.name = componentName(c.name);
      break;
    }
    case "place-component": {
      if (!m.definitions[c.definition] || !finite(c.point))
        throw new Error("Choose a component and a finite placement point");
      const id = alloc(m, "c");
      m.entities[id] = {
        id,
        kind: "component",
        definition: c.definition,
        transform: { ...identity(), origin: { ...c.point } },
      };
      m.selection = [id];
      break;
    }
    case "guide": {
      const id = alloc(m, "g");
      m.entities[id] = {
        id,
        kind: "guide",
        origin: { ...c.origin },
        direction: { ...c.direction },
      };
      break;
    }
    case "draw":
      draw(m, c.segments, c.fillLoop);
      break;
    case "pushpull":
      extrude(m, c.face, c.distance, c.direction);
      break;
    case "move":
    case "rotate": {
      const ids = selectedVertices(m, c.ids);
      const rulers = c.ids
        .map((id) => m.entities[id])
        .filter((e) => e?.kind === "guide");
      if (!ids.size && !rulers.length)
        throw new Error("Select geometry to transform");
      if (
        c.type === "rotate" &&
        (!Number.isFinite(c.angle) ||
          Math.hypot(c.axis.x, c.axis.y, c.axis.z) < EPS)
      )
        throw new Error("Enter a finite angle and a valid axis");
      for (const g of rulers) {
        if (c.type === "move") g.origin = add(g.origin, c.delta);
        else {
          const end = rotate(
            add(g.origin, g.direction),
            c.center,
            c.axis,
            c.angle,
          );
          g.origin = rotate(g.origin, c.center, c.axis, c.angle);
          g.direction = unit(sub(end, g.origin));
        }
      }
      for (const id of ids) {
        const e = m.entities[id];
        if (e.kind === "vertex")
          e.position =
            c.type === "move"
              ? add(e.position, c.delta)
              : rotate(e.position, c.center, c.axis, c.angle);
      }
      break;
    }
    case "offset": {
      const face = m.entities[c.face];
      if (face?.kind !== "face") throw new Error("Choose a face to offset");
      const contours = insetContours(surface(m, face), c.distance);
      draw(
        m,
        contours.flatMap((loop) =>
          loop.map((p, i) => [p, loop[(i + 1) % loop.length]] as Segment),
        ),
      );
      break;
    }
    case "scale":
      scaleSelection(m, c.ids, c.anchor, c.factors);
      break;
    case "delete":
      erase(m, c.ids);
      break;
  }
}
