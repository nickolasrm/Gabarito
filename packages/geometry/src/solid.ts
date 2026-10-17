import factory from "manifold-3d";
import type { ManifoldToplevel } from "manifold-3d";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import { Bounds } from "./bounds";
import { EPS } from "./tol";
import { poly } from "./poly";
import { rect } from "./rect";
import { vec3 } from "./vec3";
import type { Vec3 } from "./vec3";

/**
 * Solid cuts through a mesh CSG kernel (decision 0022).
 *
 * No manifold type crosses this interface: loops and boxes in, welded triangles with consistent
 * outward winding out.
 */

/** Welded triangles of a solid: `triangles` indexes `positions` in threes, wound outward. */
export interface SolidMesh {
  positions: Vec3[];
  triangles: number[];
}

/** One face of a solid's shell: its outer loop and the loops of any holes inside it. */
export interface ShellFace {
  outer: Vec3[];
  holes: Vec3[][];
}

let toplevel: ManifoldToplevel | null = null;
let pending: Promise<ManifoldToplevel> | null = null;

const load = (): Promise<ManifoldToplevel> => {
  // The glue finds the .wasm next to itself in Node; a bundler needs the emitted URL in a browser.
  const options = typeof window === "undefined" ? undefined : { locateFile: () => wasmUrl };
  pending ??= factory(options).then((wasm) => {
    wasm.setup();
    toplevel = wasm;
    return wasm;
  });
  return pending;
};

// Start initialising on first use — importing this module is using it — so a cut a moment later
// finds the kernel ready without the boot path becoming asynchronous.
void load().catch(() => {
  // A failed load surfaces at the first cut as "still loading" rather than an unhandled rejection.
  pending = null;
});

/** Resolves once the kernel is ready; idempotent. */
export function ensureSolid(): Promise<void> {
  return load().then(() => undefined);
}

/** Whether the kernel has finished initialising; a cut before that is refused, never wrong. */
export function solidReady(): boolean {
  return toplevel !== null;
}

const boxOf = (b: Bounds): InstanceType<ManifoldToplevel["Manifold"]> => {
  const { Manifold } = toplevel as ManifoldToplevel;
  return Manifold.cube([b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]).translate([
    b.min.x,
    b.min.y,
    b.min.z,
  ]);
};

/**
 * The solid `outer` minus `inner`, both axis-aligned boxes.
 *
 * Throws when the kernel is not ready, or when the result fails the closedness and winding checks —
 * kernel output is untrusted geometry until it proves closed (decision 0019).
 */
export function subtractSolid(outer: Bounds, inner: Bounds): SolidMesh {
  if (!toplevel) throw new Error("The geometry engine is still loading");
  const result = boxOf(outer).subtract(boxOf(inner));
  return meshOf(result, "The cut kernel refused the subtraction");
}

/**
 * The solid bounded by `shell` swept against the box `tool`: material in the sweep → subtraction;
 * the sweep empty → union, which is the pull that adds material — filling a cavity, trimming its
 * walls, instead of stacking a prism (decision 0025). The verb says which.
 *
 * `shell` is the closed surface of a rectilinear solid: every loop an axis-aligned rectangle in its
 * face's plane. It is welded, triangulated — the kernel's own triangulator handles a face with
 * holes — oriented outward, and handed to `ofMesh`; a status other than `NoError` throws, so a
 * flawed solid is refused rather than cut wrongly.
 */
export function sweepShell(shell: ShellFace[], tool: Bounds): { verb: "cut" | "add"; mesh: SolidMesh } {
  if (!toplevel) throw new Error("The geometry engine is still loading");
  const { Manifold, Mesh, triangulate } = toplevel;
  if (shell.length === 0) throw new Error("The solid has no faces to cut");

  const keys = new Map<string, number>();
  const vertProperties: number[] = [];
  const weld = (point: Vec3): number => {
    const key = `${Math.round(point.x / 1e-3)},${Math.round(point.y / 1e-3)},${Math.round(point.z / 1e-3)}`;
    let index = keys.get(key);
    if (index === undefined) {
      index = vertProperties.length / 3;
      keys.set(key, index);
      vertProperties.push(point.x, point.y, point.z);
    }
    return index;
  };

  const triVerts: number[] = [];
  for (const { outer, holes } of shell) {
    const normal = poly.normal(outer);
    if (!normal) throw new Error("The solid has a face that is not planar");
    const axis =
      Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z)
        ? "x"
        : Math.abs(normal.y) >= Math.abs(normal.z)
          ? "y"
          : "z";
    const value = outer[0][axis];
    const [u, v] = rect.inPlaneAxes(axis);
    for (const loop of [outer, ...holes]) {
      for (const point of loop) {
        if (Math.abs(point[axis] - value) > EPS.MERGE) {
          throw new Error("The solid has a face that is not axis-aligned");
        }
      }
    }
    for (const [a, b, c] of triangulateFace([outer, ...holes], u, v, triangulate)) {
      const winding = vec3.cross(vec3.sub(b, a), vec3.sub(c, a));
      const flip = vec3.dot(winding, normal) < 0;
      triVerts.push(weld(a), weld(flip ? c : b), weld(flip ? b : c));
    }
  }

  const solid = Manifold.ofMesh(
    new Mesh({
      numProp: 3,
      vertProperties: Float32Array.from(vertProperties),
      triVerts: Uint32Array.from(triVerts),
    }),
  );
  const status = solid.status();
  if (status !== "NoError") {
    throw new Error(`The solid has a flaw the cut cannot pass (${status})`);
  }

  const toolManifold = boxOf(tool);
  // Material in the sweep decides cut against add, immune to how the pushed face happens to be wound.
  const verb = solid.intersect(toolManifold).volume() > 1e-6 ? "cut" : "add";
  const result = verb === "cut" ? solid.subtract(toolManifold) : solid.add(toolManifold);
  return {
    verb,
    mesh: meshOf(
      result,
      verb === "cut" ? "The cut kernel refused the subtraction" : "The kernel refused the union",
    ),
  };
}

/**
 * Triangulate one face's loops in its projected plane.
 *
 * The kernel triangulator reads the first contour as the outer and the rest as holes under a
 * nonzero fill rule: the outer must wind counter-clockwise in the projection and every hole
 * clockwise, or the hole is swallowed whole. The document winds a −axis face's outer clockwise, so
 * both are normalised here on their own signed area. The result is checked against the count a
 * region with that many holes must have — a swallowed hole cannot tile an annulus — and refused
 * rather than passed on.
 */
function triangulateFace(
  loops: Vec3[][],
  u: "x" | "y" | "z",
  v: "x" | "y" | "z",
  triangulate: (polygons: [number, number][][], epsilon?: number, allowConvex?: boolean) => [number, number, number][],
): Array<[Vec3, Vec3, Vec3]> {
  const signed2D = (loop: Vec3[]): number =>
    loop.reduce(
      (sum, point, index) =>
        sum + point[u] * loop[(index + 1) % loop.length][v] - loop[(index + 1) % loop.length][u] * point[v],
      0,
    );

  const [outer, ...holes] = loops;
  const outerCCW = signed2D(outer) < 0 ? [...outer].reverse() : outer;
  const holesCW = holes.map((hole) => (signed2D(hole) > 0 ? [...hole].reverse() : hole));
  const flat = [outerCCW, ...holesCW].map((loop) => loop.map((p) => [p[u], p[v]] as [number, number]));

  const triangles = triangulate(flat);
  const expected = loops.reduce((sum, loop) => sum + loop.length, 0) - 2 + 2 * holes.length;
  if (triangles.length !== expected) {
    throw new Error("The cut kernel produced a face the document cannot hold");
  }
  const corners = [outerCCW, ...holesCW].flat();
  return triangles.map((t) => [corners[t[0]], corners[t[1]], corners[t[2]]]);
}

/** A kernel result as a validated `SolidMesh`, or the given refusal message. */
function meshOf(result: { status(): string; getMesh(): { numProp: number; vertProperties: Float32Array; triVerts: Uint32Array } }, message: string): SolidMesh {
  if (result.status() !== "NoError") throw new Error(message);
  const mesh = result.getMesh();
  if (mesh.triVerts.length === 0) throw new Error("Nothing left after the cut");
  const positions: Vec3[] = [];
  for (let index = 0; index < mesh.vertProperties.length; index += mesh.numProp) {
    positions.push(
      vec3.of(
        mesh.vertProperties[index],
        mesh.vertProperties[index + 1],
        mesh.vertProperties[index + 2],
      ),
    );
  }
  const triangles: number[] = [...mesh.triVerts];
  validateClosed(positions, triangles);
  return { positions, triangles };
}

/** Every edge used twice, once each way, and the volume the winding sums to is positive. */
function validateClosed(positions: Vec3[], triangles: number[]): void {
  const uses = new Map<string, number>();
  const count = (a: number, b: number): number => uses.get(`${a}>${b}`) ?? 0;
  let volume = 0;
  for (let index = 0; index < triangles.length; index += 3) {
    const [a, b, c] = [triangles[index], triangles[index + 1], triangles[index + 2]];
    if (a === b || b === c || a === c) throw new Error("The cut kernel produced a degenerate triangle");
    uses.set(`${a}>${b}`, count(a, b) + 1);
    uses.set(`${b}>${c}`, count(b, c) + 1);
    uses.set(`${c}>${a}`, count(c, a) + 1);
    const [p, q, r] = [positions[a], positions[b], positions[c]];
    volume += vec3.dot(p, vec3.cross(q, r)) / 6;
  }
  for (const [key, forward] of uses) {
    const [a, b] = key.split(">").map(Number);
    if (forward !== count(b, a) || forward !== 1) {
      throw new Error("The cut kernel produced an open or self-touching surface");
    }
  }
  if (volume <= 0) throw new Error("The cut kernel produced an inside-out solid");
}
