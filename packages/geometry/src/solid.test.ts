import { beforeAll, describe, expect, it } from "vitest";
import { ensureSolid, solidReady, subtractSolid } from "./solid";
import { vec3 } from "./vec3";
import type { Bounds, SolidMesh } from "./index";

/** Every edge used exactly twice, once in each direction, and the winding sums to positive volume. */
function closedAndOutward(mesh: SolidMesh): boolean {
  const uses = new Map<string, number>();
  const count = (a: number, b: number): number => uses.get(`${a}>${b}`) ?? 0;
  let volume = 0;
  for (let index = 0; index < mesh.triangles.length; index += 3) {
    const [a, b, c] = [mesh.triangles[index], mesh.triangles[index + 1], mesh.triangles[index + 2]];
    uses.set(`${a}>${b}`, count(a, b) + 1);
    uses.set(`${b}>${c}`, count(b, c) + 1);
    uses.set(`${c}>${a}`, count(c, a) + 1);
    const [p, q, r] = [mesh.positions[a], mesh.positions[b], mesh.positions[c]];
    volume += vec3.dot(p, vec3.cross(q, r)) / 6;
  }
  for (const [key, forward] of uses) {
    const [a, b] = key.split(">").map(Number);
    if (forward !== count(b, a) || forward !== 1) return false;
  }
  return volume > 0;
}

const box = (min: [number, number, number], max: [number, number, number]): Bounds => ({
  min: vec3.of(...min),
  max: vec3.of(...max),
});

const SHELL = box([0, 0, 0], [2000, 2000, 2000]);
const TOOL = box([700, 700, -1000], [1300, 1300, 3000]);

describe("subtractSolid", () => {
  beforeAll(async () => {
    await ensureSolid();
  });

  it("is ready once ensureSolid resolves", () => {
    expect(solidReady()).toBe(true);
  });

  it("cuts a recess closed and outward", () => {
    const mesh = subtractSolid(SHELL, box([700, 700, 1500], [1300, 1300, 3000]));
    expect(closedAndOutward(mesh)).toBe(true);
  });

  it("cuts right through closed and outward", () => {
    const mesh = subtractSolid(SHELL, TOOL);
    expect(closedAndOutward(mesh)).toBe(true);
    // A cube with a square tunnel: 16 corners, and the volume reads the tunnel out of the cube.
    const vertices = new Set(mesh.triangles);
    expect(vertices.size).toBe(16);
    let volume = 0;
    for (let index = 0; index < mesh.triangles.length; index += 3) {
      const [a, b, c] = [mesh.triangles[index], mesh.triangles[index + 1], mesh.triangles[index + 2]];
      volume += vec3.dot(mesh.positions[a], vec3.cross(mesh.positions[b], mesh.positions[c])) / 6;
    }
    expect(volume).toBeCloseTo(2000 * 2000 * 2000 - 600 * 600 * 2000, 0);
  });
});
