import factory from "manifold-3d";
import type { ManifoldToplevel } from "manifold-3d";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import { Bounds } from "./bounds";
import { vec3 } from "./vec3";
import type { Vec3 } from "./vec3";

/**
 * Solid cuts through a mesh CSG kernel (decision 0022).
 *
 * The kernel only ever subtracts two axis-aligned boxes, so the input is manifold by construction —
 * the failure that ended the earlier kernel attempt (decision 0021). No manifold type crosses this
 * interface: boxes in, welded triangles with consistent outward winding out.
 */

/** Welded triangles of a solid: `triangles` indexes `positions` in threes, wound outward. */
export interface SolidMesh {
  positions: Vec3[];
  triangles: number[];
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

/**
 * The solid `outer` minus `inner`, both axis-aligned boxes.
 *
 * Throws when the kernel is not ready, or when the result fails the closedness and winding checks —
 * kernel output is untrusted geometry until it proves closed (decision 0019).
 */
export function subtractSolid(outer: Bounds, inner: Bounds): SolidMesh {
  if (!toplevel) throw new Error("The geometry engine is still loading");
  const { Manifold } = toplevel;

  const box = (b: Bounds): InstanceType<typeof Manifold> =>
    Manifold.cube([b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]).translate([
      b.min.x,
      b.min.y,
      b.min.z,
    ]);

  const result = box(outer).subtract(box(inner));
  if (result.status() !== "NoError") {
    throw new Error(`The cut kernel refused the subtraction (${result.status()})`);
  }

  const mesh = result.getMesh();
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
