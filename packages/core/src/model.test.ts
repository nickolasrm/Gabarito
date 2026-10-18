import { beforeAll, describe, it, expect } from "vitest";
import {
  V,
  initializeGeometry,
  triangulate,
  volume,
  EPS,
  rotate,
  near,
} from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { createStore, isClosed } from "./store";
import type { Store, Command } from "./store";
import {
  faces,
  vertices,
  edges,
  surface,
  meshOfModel,
  validate,
  position,
  loops,
  edgeKey,
} from "./model";
import { parseDimensions } from "./input";
beforeAll(initializeGeometry);
export function rectangle(
  s: Store,
  x = 0,
  y = 0,
  w = 100,
  h = 100,
  z = 0,
): void {
  const p = [V(x, y, z), V(x + w, y, z), V(x + w, y + h, z), V(x, y + h, z)];
  s.execute({ type: "draw", segments: p.map((a, i) => [a, p[(i + 1) % 4]]) });
}
export function area(s: Store): number {
  let result = 0;
  for (const f of faces(s.getState())) {
    const mesh = triangulate(surface(s.getState(), f));
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const [a, b, c] = mesh.triangles
        .slice(i, i + 3)
        .map((k) => mesh.points[k]);
      const u = [b.x - a.x, b.y - a.y, b.z - a.z],
        v = [c.x - a.x, c.y - a.y, c.z - a.z];
      result +=
        Math.hypot(
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ) / 2;
    }
  }
  return result;
}
function top(s: Store, z: number, x = 50, y = 50): string {
  const m = s.getState();
  const f = faces(m).find(
    (f) =>
      f.outer.every((id) => Math.abs(position(m, id).z - z) < EPS) &&
      !f.holes.length &&
      f.outer.some(
        (id) =>
          Math.abs(position(m, id).x - x) <= 50 &&
          Math.abs(position(m, id).y - y) <= 50,
      ),
  );
  if (!f) throw new Error("No face at requested height");
  return f.id;
}
function cube(): Store {
  const s = createStore();
  rectangle(s);
  s.execute({
    type: "pushpull",
    face: faces(s.getState())[0].id,
    distance: 100,
  });
  return s;
}
function inverse(s: Store, c: Command): void {
  const before = structuredClone(s.getState().entities);
  s.execute(c);
  const after = structuredClone(s.getState().entities);
  s.undo();
  expect(s.getState().entities).toEqual(before);
  s.redo();
  expect(s.getState().entities).toEqual(after);
}
describe("planar shared topology", () => {
  it("closes a triangle only when its missing edge is added", () => {
    const s = createStore(),
      a = V(),
      b = V(100),
      c = V(0, 100);
    s.execute({
      type: "draw",
      segments: [
        [a, b],
        [b, c],
      ],
    });
    expect(faces(s.getState())).toHaveLength(0);
    inverse(s, { type: "draw", segments: [[c, a]] });
    expect(faces(s.getState())).toHaveLength(1);
    expect(area(s)).toBeCloseTo(5000);
  });
  it("partitions a parent face before extrusion without doubled area", () => {
    const s = createStore();
    rectangle(s);
    rectangle(s, 20, 20, 30, 30);
    expect(faces(s.getState())).toHaveLength(2);
    expect(
      faces(s.getState()).filter((f) => f.holes.length === 1),
    ).toHaveLength(1);
    expect(area(s)).toBeCloseTo(10000);
  });
  it("supports nested and disjoint holes without an arbitrary limit", () => {
    const s = createStore();
    rectangle(s, 0, 0, 1000, 1000);
    for (let i = 0; i < 6; i++) rectangle(s, 20 + i * 150, 20, 100, 100);
    rectangle(s, 40, 40, 30, 30);
    expect(faces(s.getState())).toHaveLength(8);
    expect(Math.max(...faces(s.getState()).map((f) => f.holes.length))).toBe(6);
    expect(area(s)).toBeCloseTo(1e6);
  });
  it("splits a diagonal into two cells without retaining its old parent", () => {
    const s = createStore();
    rectangle(s);
    s.execute({ type: "draw", segments: [[V(), V(100, 100)]] });
    expect(faces(s.getState())).toHaveLength(2);
    expect(area(s)).toBeCloseTo(10000);
  });
  it("splits crossings and T-junctions with shared boundary vertices", () => {
    const s = createStore();
    rectangle(s);
    s.execute({
      type: "draw",
      segments: [
        [V(0, 50), V(100, 50)],
        [V(50, 0), V(50, 100)],
      ],
    });
    expect(faces(s.getState())).toHaveLength(4);
    expect(vertices(s.getState())).toHaveLength(9);
    expect(edges(s.getState())).toHaveLength(12);
    expect(area(s)).toBeCloseTo(10000);
  });
  it("welds overlapping edges rather than duplicating them", () => {
    const s = createStore();
    s.execute({
      type: "draw",
      segments: [
        [V(), V(100)],
        [V(50), V(150)],
      ],
    });
    expect(edges(s.getState())).toHaveLength(3);
    expect(vertices(s.getState())).toHaveLength(4);
  });
  it("does not recreate a manually deleted face on an unrelated drawing", () => {
    const s = createStore();
    rectangle(s);
    s.execute({ type: "delete", ids: [faces(s.getState())[0].id] });
    s.execute({ type: "draw", segments: [[V(200), V(300)]] });
    expect(faces(s.getState())).toHaveLength(0);
  });
  it("does not enumerate every cycle of a grid", () => {
    const s = createStore();
    const segments: [Vec3, Vec3][] = [];
    for (let i = 0; i <= 10; i++) {
      segments.push(
        [V(i * 10, 0), V(i * 10, 100)],
        [V(0, i * 10), V(100, i * 10)],
      );
    }
    s.execute({ type: "draw", segments });
    expect(faces(s.getState())).toHaveLength(100);
    expect(area(s)).toBeCloseTo(10000);
  });
});
describe("solid editing", () => {
  it("extrudes a face into a closed solid with the requested volume", () => {
    const s = createStore();
    rectangle(s);
    inverse(s, {
      type: "pushpull",
      face: faces(s.getState())[0].id,
      distance: 100,
    });
    expect(isClosed(faces(s.getState()))).toBe(true);
    expect(volume(meshOfModel(s.getState()))).toBeCloseTo(1e6, 0);
    expect(faces(s.getState())).toHaveLength(6);
  });
  it("cuts a recess then fills it back without internal surfaces", () => {
    const s = cube();
    rectangle(s, 20, 20, 30, 30, 100);
    expect(isClosed(faces(s.getState()))).toBe(true);
    const inner = faces(s.getState()).find((f) =>
      f.outer.every((id) => {
        const p = position(s.getState(), id);
        return p.z === 100 && p.x >= 20 && p.x <= 50 && p.y >= 20 && p.y <= 50;
      }),
    )!;
    inverse(s, { type: "pushpull", face: inner.id, distance: -20 });
    expect(isClosed(faces(s.getState()))).toBe(true);
    expect(volume(meshOfModel(s.getState()))).toBeCloseTo(1e6 - 18000, 0);
    const floor = top(s, 80, 35, 35);
    s.execute({ type: "pushpull", face: floor, distance: 20 });
    expect(volume(meshOfModel(s.getState()))).toBeCloseTo(1e6, 0);
    expect(faces(s.getState())).toHaveLength(6);
  });
  it("cuts through a solid and permits a second cut", () => {
    const s = cube();
    for (const x of [10, 60]) {
      rectangle(s, x, 20, 20, 20, 100);
      const m = s.getState(),
        inner = faces(m).find(
          (f) =>
            !f.holes.length &&
            f.outer.every((id) => {
              const p = position(m, id);
              return (
                p.z === 100 &&
                p.x >= x &&
                p.x <= x + 20 &&
                p.y >= 20 &&
                p.y <= 40
              );
            }),
        )!;
      s.execute({ type: "pushpull", face: inner.id, distance: -120 });
      expect(isClosed(faces(s.getState()))).toBe(true);
    }
    expect(volume(meshOfModel(s.getState()))).toBeCloseTo(920000, 0);
  });
  it("edits a rotated solid using its face normal", () => {
    const s = cube();
    s.execute({
      type: "rotate",
      ids: Object.keys(s.getState().entities),
      center: V(),
      axis: V(0, 1, 0),
      angle: Math.PI / 5,
    });
    const m = s.getState(),
      f = faces(m)[0];
    s.execute({ type: "pushpull", face: f.id, distance: 10 });
    expect(isClosed(faces(s.getState()))).toBe(true);
    expect(volume(meshOfModel(s.getState()))).toBeCloseTo(1100000, -1);
  });
  it("extrudes concave polygons and faces with holes", () => {
    const s = createStore();
    rectangle(s);
    rectangle(s, 20, 20, 30, 30);
    const ring = faces(s.getState()).find((f) => f.holes.length)!;
    s.execute({
      type: "delete",
      ids: [faces(s.getState()).find((f) => !f.holes.length)!.id],
    });
    s.execute({ type: "pushpull", face: ring.id, distance: 10 });
    expect(isClosed(faces(s.getState()))).toBe(true);
    expect(volume(meshOfModel(s.getState()))).toBeCloseTo(91000, 0);
  });
});
describe("general sweeps", () => {
  it("extrudes a concave polygon with its actual polygon area", () => {
    const s = createStore(),
      points = [V(), V(100), V(100, 40), V(40, 40), V(40, 100), V(0, 100)];
    s.execute({
      type: "draw",
      segments: points.map((p, i) => [p, points[(i + 1) % points.length]]),
    });
    s.execute({
      type: "pushpull",
      face: faces(s.getState())[0].id,
      distance: 20,
    });
    expect(isClosed(faces(s.getState()))).toBe(true);
    expect(volume(meshOfModel(s.getState()))).toBeCloseTo(128000, 0);
  });
  it("extrudes in the negative direction with outward winding", () => {
    const s = createStore();
    rectangle(s);
    s.execute({
      type: "pushpull",
      face: faces(s.getState())[0].id,
      distance: -20,
    });
    expect(isClosed(faces(s.getState()))).toBe(true);
    expect(volume(meshOfModel(s.getState()))).toBeCloseTo(200000, 0);
  });
  it("supports repeated recess and refill without accumulating internal walls", () => {
    const s = cube();
    for (let i = 0; i < 5; i++) {
      rectangle(s, 20, 20, 30, 30, 100);
      const inner = faces(s.getState()).find(
        (f) =>
          !f.holes.length &&
          f.outer.every((id) => {
            const p = position(s.getState(), id);
            return (
              p.z === 100 && p.x >= 20 && p.x <= 50 && p.y >= 20 && p.y <= 50
            );
          }),
      )!;
      s.execute({ type: "pushpull", face: inner.id, distance: -20 });
      s.execute({ type: "pushpull", face: top(s, 80, 35, 35), distance: 20 });
      expect(isClosed(faces(s.getState()))).toBe(true);
      expect(faces(s.getState())).toHaveLength(6);
      expect(volume(meshOfModel(s.getState()))).toBeCloseTo(1e6, 0);
    }
  });
});
describe("open sheets", () => {
  it("pulls a subdivided flat sheet without adding a doubled base face", () => {
    const s = createStore();
    rectangle(s);
    rectangle(s, 20, 20, 30, 30);
    const m = s.getState(),
      inner = faces(m).find((f) => !f.holes.length)!;
    s.execute({ type: "pushpull", face: inner.id, distance: 20 });
    expect(faces(s.getState())).toHaveLength(6);
    expect(
      faces(s.getState()).filter((f) =>
        f.outer.every((id) => position(s.getState(), id).z === 0),
      ),
    ).toHaveLength(1);
  });
});
describe("raised open sheets", () => {
  function raised(): Store {
    const s = createStore();
    rectangle(s, 0, 0, 200, 200);
    rectangle(s, 50, 50, 100, 100);
    s.execute({ type: "pushpull", face: top(s, 0, 100, 100), distance: 100 });
    return s;
  }
  it.each([20, -20])(
    "pushes/pulls a nested face on a previously raised sheet by %s",
    (distance) => {
      const s = raised();
      rectangle(s, 75, 75, 50, 50, 100);
      const m = s.getState(),
        inner = faces(m).find(
          (f) =>
            !f.holes.length &&
            f.outer.every((id) => {
              const p = position(m, id);
              return (
                p.z === 100 &&
                p.x >= 75 &&
                p.x <= 125 &&
                p.y >= 75 &&
                p.y <= 125
              );
            }),
        )!;
      inverse(s, { type: "pushpull", face: inner.id, distance });
      expect(faces(s.getState())).toHaveLength(11);
      expect(
        vertices(s.getState()).some(
          (v) => Math.abs(v.position.z - (100 + distance)) < EPS,
        ),
      ).toBe(true);
      expect(isClosed(faces(s.getState()))).toBe(false);
      validate(s.getState());
    },
  );
  it("repeatedly pushes and refills nested top faces while preserving the sheet perimeter", () => {
    const s = raised();
    for (const distance of [20, -20, 30, -30]) {
      rectangle(s, 75, 75, 50, 50, 100);
      const m = s.getState(),
        inner = faces(m).find(
          (f) =>
            !f.holes.length &&
            f.outer.every((id) => {
              const p = position(m, id);
              return (
                p.z === 100 &&
                p.x >= 75 &&
                p.x <= 125 &&
                p.y >= 75 &&
                p.y <= 125
              );
            }),
        )!;
      s.execute({ type: "pushpull", face: inner.id, distance });
      const cap = faces(s.getState()).find((f) =>
        f.outer.every(
          (id) =>
            Math.abs(position(s.getState(), id).z - (100 + distance)) < EPS,
        ),
      )!;
      s.execute({ type: "pushpull", face: cap.id, distance: -distance });
      expect(faces(s.getState())).toHaveLength(6);
      expect(area(s)).toBeCloseTo(80000);
      const counts = new Map<string, number>(),
        directions = new Map<string, number>();
      for (const f of faces(s.getState()))
        for (const l of loops(f))
          l.forEach((a, i) => {
            const b = l[(i + 1) % l.length],
              k = edgeKey(a, b);
            counts.set(k, (counts.get(k) ?? 0) + 1);
            directions.set(k, (directions.get(k) ?? 0) + (a < b ? 1 : -1));
          });
      expect([...counts.values()].filter((n) => n === 1)).toHaveLength(4);
      expect([...counts.values()].every((n) => n === 1 || n === 2)).toBe(true);
      for (const [key, n] of counts)
        if (n === 2) expect(directions.get(key)).toBe(0);
    }
  });
  it("pushes a nested face on a rotated raised sheet", () => {
    const s = raised(),
      transform = (p: Vec3) => rotate(p, V(), V(1, 2, 3), Math.PI / 5);
    s.execute({
      type: "rotate",
      ids: Object.keys(s.getState().entities),
      center: V(),
      axis: V(1, 2, 3),
      angle: Math.PI / 5,
    });
    const ps = [
      V(75, 75, 100),
      V(125, 75, 100),
      V(125, 125, 100),
      V(75, 125, 100),
    ].map(transform);
    s.execute({
      type: "draw",
      segments: ps.map((p, i) => [p, ps[(i + 1) % 4]]),
    });
    const inner = faces(s.getState()).find((f) =>
      f.outer.every((id) =>
        ps.some((p) => near(p, position(s.getState(), id))),
      ),
    )!;
    s.execute({ type: "pushpull", face: inner.id, distance: -20 });
    expect(
      vertices(s.getState()).some((v) =>
        near(v.position, transform(V(75, 75, 80))),
      ),
    ).toBe(true);
    validate(s.getState());
  });
  it("still rejects tangent extrusion without changing the model or history", () => {
    const s = raised(),
      before = structuredClone(s.getState());
    expect(() =>
      s.execute({
        type: "pushpull",
        face: top(s, 100, 100, 100),
        distance: 20,
        direction: V(1, 0, 0),
      }),
    ).toThrow(/leave the face plane/);
    expect(s.getState()).toEqual(before);
    s.undo();
    expect(faces(s.getState())).toHaveLength(2);
  });
  it("retracts the entire raised top without overlapping side walls", () => {
    const s = raised();
    inverse(s, {
      type: "pushpull",
      face: top(s, 100, 100, 100),
      distance: -40,
    });
    expect(area(s)).toBeCloseTo(40000 + 400 * 60);
    expect(
      Math.max(...vertices(s.getState()).map((v) => v.position.z)),
    ).toBeCloseTo(60);
    expect(faces(s.getState())).toHaveLength(6);
  });
  it("extends a raised top without seams in the existing walls", () => {
    const s = raised();
    s.execute({ type: "pushpull", face: top(s, 100, 100, 100), distance: 40 });
    expect(area(s)).toBeCloseTo(40000 + 400 * 140);
    expect(faces(s.getState())).toHaveLength(6);
  });
  it("returns a raised patch to the sheet without duplicate base faces", () => {
    const s = raised();
    s.execute({
      type: "pushpull",
      face: top(s, 100, 100, 100),
      distance: -100,
    });
    expect(area(s)).toBeCloseTo(40000);
    expect(faces(s.getState())).toHaveLength(1);
  });
});
describe("transactions", () => {
  it("moves and rotates shared vertices with exact inverse history", () => {
    const s = createStore();
    rectangle(s);
    const ids = Object.keys(s.getState().entities);
    inverse(s, { type: "move", ids, delta: V(0, 0, 10) });
    inverse(s, {
      type: "rotate",
      ids,
      center: V(),
      axis: V(0, 0, 1),
      angle: Math.PI / 4,
    });
    validate(s.getState());
  });
  it("deletes boundary topology and restores it with undo", () => {
    const s = cube();
    inverse(s, { type: "delete", ids: [vertices(s.getState())[0].id] });
    expect(faces(s.getState())).toHaveLength(3);
  });
  it("rolls back invalid transforms and preserves redo", () => {
    const s = createStore();
    rectangle(s);
    s.undo();
    const before = structuredClone(s.getState());
    expect(() =>
      s.execute({ type: "draw", segments: [[V(), V(NaN)]] }),
    ).toThrow();
    expect(s.getState()).toEqual(before);
    expect(s.canRedo()).toBe(true);
    s.redo();
    const original = structuredClone(s.getState());
    expect(() =>
      s.execute({
        type: "move",
        ids: [vertices(s.getState())[0].id],
        delta: V(0, 0, 10),
      }),
    ).toThrow(/nonplanar/);
    expect(s.getState()).toEqual(original);
  });
  it("never reuses entity IDs after undo and a new edit", () => {
    const s = createStore();
    rectangle(s);
    const old = new Set(Object.keys(s.getState().entities));
    s.undo();
    rectangle(s, 200);
    expect(Object.keys(s.getState().entities).some((id) => old.has(id))).toBe(
      false,
    );
  });
  it("validates dimension grammar and explicit units", () => {
    expect(parseDimensions("100,2m", "mm", 2)).toEqual([100, 2000]);
    expect(parseDimensions("-10cm", "mm")).toEqual([-100]);
    for (const text of ["10foo", "Infinity", "0", "10,20", "1e309", ""])
      expect(() => parseDimensions(text, "mm")).toThrow();
  });
});
