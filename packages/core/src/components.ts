import { V, add, sub, mul, dot, cross, finite } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import {
  createModel,
  alloc,
  edges,
  faces,
  loops,
  selectedVertices,
  vertices,
} from "./model";
import type { Model, Entity } from "./model";

export interface Transform {
  origin: Vec3;
  x: Vec3;
  y: Vec3;
  z: Vec3;
}
export interface Component {
  id: string;
  kind: "component";
  definition: string;
  transform: Transform;
}
export interface GeometryScope {
  entities: Record<string, Entity>;
  erased: Model["erased"];
}
export interface ComponentDefinition {
  id: string;
  name: string;
  geometry: GeometryScope;
}
export const identity = (): Transform => ({
  origin: V(),
  x: V(1),
  y: V(0, 1),
  z: V(0, 0, 1),
});
export const transformDirection = (t: Transform, p: Vec3): Vec3 =>
  add(mul(t.x, p.x), add(mul(t.y, p.y), mul(t.z, p.z)));
export const transformPoint = (t: Transform, p: Vec3): Vec3 =>
  add(t.origin, transformDirection(t, p));
export function inverseTransform(t: Transform): Transform {
  const determinant = dot(t.x, cross(t.y, t.z));
  if (
    !Object.values(t).every(finite) ||
    !Number.isFinite(determinant) ||
    Math.abs(determinant) < 1e-12
  )
    throw new Error("Component transform must be finite and invertible");
  const a = mul(cross(t.y, t.z), 1 / determinant),
    b = mul(cross(t.z, t.x), 1 / determinant),
    c = mul(cross(t.x, t.y), 1 / determinant);
  return {
    origin: V(-dot(a, t.origin), -dot(b, t.origin), -dot(c, t.origin)),
    x: V(a.x, b.x, c.x),
    y: V(a.y, b.y, c.y),
    z: V(a.z, b.z, c.z),
  };
}
export function mapTransform(t: Transform, fn: (p: Vec3) => Vec3): Transform {
  const origin = fn(t.origin);
  return {
    origin,
    x: sub(fn(add(t.origin, t.x)), origin),
    y: sub(fn(add(t.origin, t.y)), origin),
    z: sub(fn(add(t.origin, t.z)), origin),
  };
}
export const compose = (a: Transform, b: Transform): Transform =>
  mapTransform(b, (p) => transformPoint(a, p));
export function mapScope(scope: GeometryScope, t: Transform): GeometryScope {
  const result = structuredClone({
    entities: scope.entities,
    erased: scope.erased,
  });
  for (const e of Object.values(result.entities)) {
    if (e.kind === "vertex") e.position = transformPoint(t, e.position);
    if (e.kind === "guide") {
      e.origin = transformPoint(t, e.origin);
      e.direction = transformDirection(t, e.direction);
    }
    if (e.kind === "component") e.transform = compose(t, e.transform);
  }
  return result;
}
export function componentName(name: string): string {
  const value = name.trim();
  if (!value || value.length > 120)
    throw new Error("Use a component name of 1–120 characters");
  return value;
}
export function makeComponent(m: Model, ids: string[], name: string): void {
  name = componentName(name);
  const chosen = new Set(ids.filter((id) => m.entities[id])),
    points = selectedVertices(m, [...chosen]);
  for (const id of points) chosen.add(id);
  const selectedFaces = faces(m).filter((f) => chosen.has(f.id));
  for (const e of edges(m))
    if (
      selectedFaces.some((f) =>
        loops(f).some((l) =>
          l.some(
            (a, i) =>
              (e.vertices[0] === a &&
                e.vertices[1] === l[(i + 1) % l.length]) ||
              (e.vertices[1] === a && e.vertices[0] === l[(i + 1) % l.length]),
          ),
        ),
      )
    )
      chosen.add(e.id);
  if (!chosen.size) throw new Error("Select geometry to make a component");
  const geometry: GeometryScope = {
    entities: {},
    erased: structuredClone(
      m.erased.filter((f) =>
        loops(f)
          .flat()
          .every((id) => chosen.has(id)),
      ),
    ),
  };
  for (const id of chosen)
    geometry.entities[id] = structuredClone(m.entities[id]);
  const bounds = vertices(expandModel({ ...m, ...geometry })).map(
    (v) => v.position,
  );
  const origin = bounds.length
    ? V(
        ...((["x", "y", "z"] as const).map((a) =>
          Math.min(...bounds.map((p) => p[a])),
        ) as [number, number, number]),
      )
    : V();
  const local = identity();
  local.origin = mul(origin, -1);
  const definition = alloc(m, "d"),
    id = alloc(m, "c");
  m.definitions[definition] = {
    id: definition,
    name,
    geometry: mapScope(geometry, local),
  };
  // Shared boundaries remain in the parent when unselected topology still needs them.
  for (const key of chosen)
    if (
      m.entities[key]?.kind === "face" ||
      m.entities[key]?.kind === "component" ||
      m.entities[key]?.kind === "guide"
    )
      delete m.entities[key];
  const neededEdges = new Set(
    faces(m).flatMap((f) =>
      loops(f).flatMap((l) =>
        l.map((a, i) => [a, l[(i + 1) % l.length]].sort().join(":")),
      ),
    ),
  );
  for (const e of edges(m))
    if (chosen.has(e.id) && !neededEdges.has([...e.vertices].sort().join(":")))
      delete m.entities[e.id];
  const neededPoints = new Set(edges(m).flatMap((e) => e.vertices));
  for (const key of points) if (!neededPoints.has(key)) delete m.entities[key];
  const remapped = new Map<string, string>();
  for (const key of chosen)
    if (m.entities[key])
      remapped.set(key, alloc(m, geometry.entities[key].kind[0]));
  if (remapped.size) {
    const key = (id: string) => remapped.get(id) ?? id;
    const renamed: Record<string, Entity> = {};
    for (const entity of Object.values(
      m.definitions[definition].geometry.entities,
    )) {
      entity.id = key(entity.id);
      if (entity.kind === "edge")
        entity.vertices = entity.vertices.map(key) as [string, string];
      if (entity.kind === "face") {
        entity.outer = entity.outer.map(key);
        entity.holes = entity.holes.map((l) => l.map(key));
      }
      renamed[entity.id] = entity;
    }
    const scope = m.definitions[definition].geometry;
    scope.entities = renamed;
    scope.erased = scope.erased.map((f) => ({
      outer: f.outer.map(key),
      holes: f.holes.map((l) => l.map(key)),
    }));
  }
  m.erased = m.erased.filter((f) =>
    loops(f)
      .flat()
      .every((id) => !!m.entities[id]),
  );
  m.entities[id] = {
    id,
    kind: "component",
    definition,
    transform: { ...identity(), origin },
  };
  m.selection = [id];
}
export function validateComponents(m: Model): void {
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (scope: GeometryScope) => {
    for (const e of Object.values(scope.entities))
      if (e.kind === "component") {
        inverseTransform(e.transform);
        const d = m.definitions[e.definition];
        if (!d) throw new Error("Missing component definition");
        if (visiting.has(d.id))
          throw new Error("A component cannot contain itself");
        if (!done.has(d.id)) {
          visiting.add(d.id);
          visit(d.geometry);
          visiting.delete(d.id);
          done.add(d.id);
        }
      }
  };
  visit(m);
  for (const d of Object.values(m.definitions)) {
    componentName(d.name);
    visiting.add(d.id);
    visit(d.geometry);
    visiting.delete(d.id);
  }
}
export interface SceneModel extends Model {
  owners: Record<string, string | null>;
  inactive: string[];
  componentEntities: string[];
  componentDefinitions: Record<string, string[]>;
}
/** Flatten only for rendering/references; derived entities never enter topology commands. */
export function expandModel(m: Model, activePath: string[] = []): SceneModel {
  const result: SceneModel = {
    ...createModel(),
    definitions: m.definitions,
    revision: m.revision,
    owners: {},
    inactive: [],
    componentEntities: [],
    componentDefinitions: {},
  };
  const walk = (
    scope: GeometryScope,
    t: Transform,
    path: string[],
    owner: string | null,
    definitions: string[],
  ) => {
    const active = path.join("/") === activePath.join("/");
    const prefix = active ? "" : `${path.join("/") || "root"}/`;
    const remap = (id: string) => prefix + id;
    for (const original of Object.values(mapScope(scope, t).entities)) {
      if (original.kind === "component") {
        const d = m.definitions[original.definition];
        if (d)
          walk(
            d.geometry,
            original.transform,
            [...path, original.id],
            active ? original.id : owner,
            [...definitions, original.definition],
          );
        continue;
      }
      const e = original;
      e.id = remap(e.id);
      if (e.kind === "edge")
        e.vertices = e.vertices.map(remap) as [string, string];
      if (e.kind === "face") {
        e.outer = e.outer.map(remap);
        e.holes = e.holes.map((l) => l.map(remap));
      }
      result.entities[e.id] = e;
      result.owners[e.id] = active ? original.id : owner;
      if (path.length) {
        result.componentEntities.push(e.id);
        result.componentDefinitions[e.id] = definitions;
      }
      if (!activePath.every((id, i) => path[i] === id))
        result.inactive.push(e.id);
    }
  };
  walk(m, identity(), [], null, []);
  return result;
}
/** Expand an active scope for bounds and transform previews, retaining atomic selection. */
export function selectionGeometry(m: Model): Model {
  const flat = expandModel(m);
  flat.selection = Object.keys(flat.entities).filter(
    (id) =>
      m.selection.includes(flat.owners[id] ?? "") || m.selection.includes(id),
  );
  return flat;
}
