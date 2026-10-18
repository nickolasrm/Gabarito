import factory from "manifold-3d";
import type { ManifoldToplevel, Manifold } from "manifold-3d";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import {
  EPS,
  V,
  add,
  dot,
  cross,
  normal,
  plane,
  project,
  area2,
  canonicalPlane,
  planeKey,
  unproject,
  inside,
} from "./math";
import type { Vec3 } from "./math";
export interface Surface {
  outer: Vec3[];
  holes: Vec3[][];
}
export interface Mesh {
  points: Vec3[];
  triangles: number[];
}
let kernel: ManifoldToplevel;
let pending: Promise<void> | undefined;
export function initializeGeometry(): Promise<void> {
  return (pending ??= factory(
    typeof window === "undefined" ? undefined : { locateFile: () => wasmUrl },
  )
    .then((k) => {
      k.setup();
      kernel = k;
    })
    .catch((e) => {
      pending = undefined;
      throw e;
    }));
}
export function triangulate(surface: Surface): Mesh {
  if (!kernel) throw new Error("Geometry engine is not initialized");
  const f = plane(surface.outer[0], normal(surface.outer));
  const loops = [surface.outer, ...surface.holes].map((loop, i) => {
    const coords = loop.map((p) => project(p, f));
    return area2(coords) > 0 === (i === 0) ? loop : [...loop].reverse();
  });
  const points = loops.flat(),
    polygons = loops.map((loop) => loop.map((p) => project(p, f)));
  const triangles = kernel.triangulate(polygons, EPS).flat();
  return { points, triangles };
}
export function volume(mesh: Mesh): number {
  let result = 0;
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const [a, b, c] = mesh.triangles.slice(i, i + 3).map((k) => mesh.points[k]);
    result += dot(a, cross(b, c)) / 6;
  }
  return result;
}
function solidOf(surfaces: Surface[]): Manifold {
  const points: Vec3[] = [],
    indices: number[] = [],
    keys = new Map<string, number>();
  const weld = (p: Vec3): number => {
    const key = [p.x, p.y, p.z].map((v) => Math.round(v / EPS)).join(":");
    let i = keys.get(key);
    if (i === undefined) {
      i = points.length;
      keys.set(key, i);
      points.push(p);
    }
    return i;
  };
  for (const surface of surfaces) {
    const mesh = triangulate(surface);
    indices.push(...mesh.triangles.map((i) => weld(mesh.points[i])));
  }
  const mesh = { points, triangles: indices };
  if (volume(mesh) < 0)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const solid = kernel.Manifold.ofMesh(
    new kernel.Mesh({
      numProp: 3,
      vertProperties: Float32Array.from(points.flatMap((p) => [p.x, p.y, p.z])),
      triVerts: Uint32Array.from(indices),
    }),
  );
  if (solid.status() !== "NoError") {
    solid.delete();
    throw new Error(
      "Push/pull requires a closed, consistently connected surface",
    );
  }
  return solid;
}
function meshOf(solid: Manifold): Mesh {
  if (solid.status() !== "NoError")
    throw new Error("The solid operation could not produce valid geometry");
  const mesh = solid.getMesh(),
    points: Vec3[] = [];
  for (let i = 0; i < mesh.vertProperties.length; i += mesh.numProp)
    points.push(
      V(
        mesh.vertProperties[i],
        mesh.vertProperties[i + 1],
        mesh.vertProperties[i + 2],
      ),
    );
  return { points, triangles: [...mesh.triVerts] };
}
export function sweep(
  surface: Surface,
  delta: Vec3,
  shell?: Surface[],
  subtract = false,
): Mesh {
  const n = normal(surface.outer);
  if (Math.abs(dot(n, delta)) < EPS)
    throw new Error("Push/pull direction must leave the face plane");
  const loops = [surface.outer, ...surface.holes];
  const cap = {
    outer: surface.outer.map((p) => add(p, delta)),
    holes: surface.holes.map((l) => l.map((p) => add(p, delta))),
  };
  const sides: Surface[] = [];
  for (const loop of loops)
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i],
        b = loop[(i + 1) % loop.length];
      sides.push({ outer: [a, b, add(b, delta), add(a, delta)], holes: [] });
    }
  const lower = {
    outer: [...surface.outer].reverse(),
    holes: surface.holes.map((l) => [...l].reverse()),
  };
  const prism = solidOf([lower, cap, ...sides]);
  let base: Manifold | undefined, result: Manifold | undefined;
  try {
    if (shell) {
      base = solidOf(shell);
      result = subtract ? base.subtract(prism) : base.add(prism);
    }
    return meshOf(result ?? prism);
  } finally {
    result?.delete();
    base?.delete();
    prism.delete();
  }
}

/** Merge only triangles connected across an edge and on the same oriented plane. */
export function surfacesOf(mesh: Mesh): Surface[] {
  const triangles: number[][] = [];
  for (let i = 0; i < mesh.triangles.length; i += 3)
    triangles.push(mesh.triangles.slice(i, i + 3));
  const normals = triangles.map((t) => normal(t.map((i) => mesh.points[i])));
  const adjacency = new Map<string, number[]>();
  const edgeKey = (a: number, b: number) =>
    [a, b].sort((a, b) => a - b).join(":");
  triangles.forEach((t, i) =>
    t.forEach((a, j) => {
      const key = edgeKey(a, t[(j + 1) % 3]);
      adjacency.set(key, [...(adjacency.get(key) ?? []), i]);
    }),
  );
  const seen = new Set<number>(),
    result: Surface[] = [];
  for (let start = 0; start < triangles.length; start++) {
    if (seen.has(start)) continue;
    const group = [start];
    seen.add(start);
    for (let i = 0; i < group.length; i++) {
      const t = triangles[group[i]];
      for (let j = 0; j < 3; j++)
        for (const next of adjacency.get(edgeKey(t[j], t[(j + 1) % 3])) ?? []) {
          if (
            !seen.has(next) &&
            dot(normals[start], normals[next]) > 1 - 1e-8
          ) {
            seen.add(next);
            group.push(next);
          }
        }
    }
    const boundary = new Map<number, number[]>();
    const members = new Set(group);
    for (const i of group)
      triangles[i].forEach((a, j) => {
        const b = triangles[i][(j + 1) % 3];
        if (
          (adjacency.get(edgeKey(a, b)) ?? []).filter((k) => members.has(k))
            .length === 1
        )
          boundary.set(a, [...(boundary.get(a) ?? []), b]);
      });
    const loops: Vec3[][] = [];
    while (boundary.size) {
      const start = boundary.keys().next().value!;
      let a = start;
      const loop: Vec3[] = [];
      do {
        loop.push(mesh.points[a]);
        const list = boundary.get(a);
        if (!list?.length) throw new Error("Invalid solid boundary");
        const b = list.pop()!;
        if (!list.length) boundary.delete(a);
        a = b;
      } while (a !== start);
      loops.push(loop);
    }
    const f = plane(loops[0][0], normals[start]);
    const outers = loops.filter((l) => area2(l.map((p) => project(p, f))) > 0);
    const holes = loops.filter((l) => area2(l.map((p) => project(p, f))) < 0);
    if (outers.length !== 1)
      throw new Error("Solid face has disconnected boundary");
    result.push({ outer: outers[0], holes });
  }
  return result;
}

/** Combine oriented patches; opposite winding cancels retracted walls instead of doubling them. */
export function mergeCoplanar(surfaces: Surface[]): Surface[] {
  const groups = new Map<
    string,
    { frame: ReturnType<typeof plane>; surfaces: Surface[] }
  >();
  for (const surface of surfaces) {
    const frame = canonicalPlane(surface.outer[0], normal(surface.outer)),
      key = planeKey(frame);
    const group = groups.get(key) ?? { frame, surfaces: [] };
    group.surfaces.push(surface);
    groups.set(key, group);
  }
  const result: Surface[] = [];
  for (const { frame, surfaces: patches } of groups.values()) {
    if (patches.length === 1) {
      result.push(patches[0]);
      continue;
    }
    const contours = patches.flatMap((s) =>
      [s.outer, ...s.holes].map((l) => l.map((p) => project(p, frame))),
    );
    for (const sign of [1, -1]) {
      const section = new kernel.CrossSection(
        contours,
        sign === 1 ? "Positive" : "Negative",
      );
      try {
        const polygons = section.toPolygons();
        const outers = polygons.filter((l) => area2(l) > EPS * EPS),
          holes = polygons.filter((l) => area2(l) < -EPS * EPS);
        const owner = holes.map(
          (hole) =>
            outers
              .map((outer, i) => ({
                i,
                area: area2(outer),
                contains: inside(hole[0], outer),
              }))
              .filter((x) => x.contains)
              .sort((a, b) => a.area - b.area)[0]?.i,
        );
        const world = (loop: [number, number][]) => {
          const points = loop.map((p) => unproject(p, frame));
          return sign === 1 ? points : points.reverse();
        };
        outers.forEach((outer, i) =>
          result.push({
            outer: world(outer),
            holes: holes.filter((_, j) => owner[j] === i).map(world),
          }),
        );
      } finally {
        section.delete();
      }
    }
  }
  return result;
}

/** Erode face material; returns every inset contour, including expanded hole boundaries. */
export function insetContours(surface: Surface, distance: number): Vec3[][] {
  if (!kernel) throw new Error("Geometry engine is not initialized");
  if (!Number.isFinite(distance) || distance <= EPS)
    throw new Error("Enter an offset greater than the geometry tolerance");
  const frame = canonicalPlane(surface.outer[0], normal(surface.outer));
  const polygons = [surface.outer, ...surface.holes].map((loop, i) => {
    const p = loop.map((p) => project(p, frame));
    return area2(p) > 0 === (i === 0) ? p : p.reverse();
  });
  const section = new kernel.CrossSection(polygons, "Positive");
  try {
    const inset = section.offset(-distance, "Miter", 1e6);
    try {
      const contours = inset
        .toPolygons()
        .filter((l) => l.length >= 3 && Math.abs(area2(l)) > EPS * EPS);
      if (!contours.length)
        throw new Error("Offset is too large for this face");
      return contours.map((loop) => loop.map((p) => unproject(p, frame)));
    } finally {
      inset.delete();
    }
  } finally {
    section.delete();
  }
}
