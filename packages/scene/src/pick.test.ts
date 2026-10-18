import { beforeAll, it, expect } from "vitest";
import { initializeGeometry, V, sub, unit } from "@gabarito/geometry";
import { createStore, vertices, edges, faces, position } from "@gabarito/core";
import { pick, faceHit } from "./pick";
import type { PickView } from "./pick";
beforeAll(initializeGeometry);
const view: PickView = {
  origin: V(0, 0, 1000),
  project(p) {
    const depth = 1000 - p.z;
    return {
      x: (p.x * 1000) / depth,
      y: (p.y * 1000) / depth,
      depth,
      visible: depth > 0,
    };
  },
  ray(x, y) {
    return {
      origin: this.origin,
      direction: unit(sub(V(x, y, 0), this.origin)),
    };
  },
};
function rectangle(z: number) {
  const s = createStore(),
    ps = [V(-100, -100, z), V(100, -100, z), V(100, 100, z), V(-100, 100, z)];
  s.execute({ type: "draw", segments: ps.map((p, i) => [p, ps[(i + 1) % 4]]) });
  return s;
}
it("never selects vertices or edges behind the camera", () => {
  const s = rectangle(1100);
  expect(pick(s.getState(), view, -1000, -1000)).toBeNull();
  expect(pick(s.getState(), view, 0, 1000)?.id).toBe("world:y");
});
it("rejects a hidden vertex even one unit behind a large foreground face", () => {
  const s = rectangle(100),
    m = s.getState();
  m.entities.hidden = { id: "hidden", kind: "vertex", position: V(0, 0, 99) };
  expect(pick(m, view, 0, 0)?.kind).toBe("face");
});
it("rejects a hidden edge within the old two-percent depth tie", () => {
  const s = rectangle(100);
  s.execute({ type: "draw", segments: [[V(-10, 0, 99), V(10, 0, 99)]] });
  expect(pick(s.getState(), view, 0, 0)?.kind).toBe("face");
});
it("selects visible boundary vertices and edges before their adjacent face", () => {
  const s = rectangle(100),
    m = s.getState();
  const v = vertices(m)[0],
    p = view.project(v.position);
  expect(pick(m, view, p.x, p.y)?.id).toBe(v.id);
  const e = edges(m)[0],
    a = position(m, e.vertices[0]),
    b = position(m, e.vertices[1]),
    center = V((a.x + b.x) / 2, (a.y + b.y) / 2, 100),
    q = view.project(center);
  expect(pick(m, view, q.x, q.y)?.id).toBe(e.id);
});
it("picks through a hole without selecting the surrounding face", () => {
  const s = rectangle(100),
    ps = [V(-20, -20, 100), V(20, -20, 100), V(20, 20, 100), V(-20, 20, 100)];
  s.execute({ type: "draw", segments: ps.map((p, i) => [p, ps[(i + 1) % 4]]) });
  s.execute({
    type: "delete",
    ids: [faces(s.getState()).find((f) => !f.holes.length)!.id],
  });
  expect(faceHit(s.getState(), view.ray(0, 0))).toBeNull();
});
it("a nearer face wins even when a farther face is much smaller", () => {
  const s = rectangle(100);
  const p = [V(-1, -1, 99), V(1, -1, 99), V(1, 1, 99), V(-1, 1, 99)];
  s.execute({ type: "draw", segments: p.map((a, i) => [a, p[(i + 1) % 4]]) });
  expect(faceHit(s.getState(), view.ray(0, 0))?.point.z).toBeCloseTo(100);
});
it("checks occlusion at the candidate position, not at the pointer ray", () => {
  const s = rectangle(100),
    m = s.getState(),
    p = V(95, 0, 99);
  m.entities.hidden = { id: "hidden", kind: "vertex", position: p };
  const screen = view.project(p);
  expect(pick(m, view, screen.x + 7, screen.y)?.id).not.toBe("hidden");
});

it("snaps exactly to a visible edge midpoint near the pointer", () => {
  const s = rectangle(100),
    p = view.project(V(0, -100, 100));
  const hit = pick(s.getState(), view, p.x + 4, p.y + 1);
  expect(hit?.snap).toBe("midpoint");
  expect(hit?.point).toEqual(V(0, -100, 100));
});
it("snaps to infinite rulers beyond their origin and to virtual crossings without creating topology", () => {
  const s = createStore();
  s.execute({ type: "guide", origin: V(10, 20), direction: V(1) });
  s.execute({ type: "guide", origin: V(35, 20), direction: V(0, 1) });
  expect(pick(s.getState(), view, 10000, 20)?.kind).toBe("guide");
  const hit = pick(s.getState(), view, 35, 20);
  expect(hit?.snap).toBe("intersection");
  expect(hit?.point).toEqual(V(35, 20));
  expect(vertices(s.getState())).toHaveLength(0);
  expect(edges(s.getState())).toHaveLength(0);
});
it("world origin and all three world axes remain snap references in an empty document", () => {
  const s = createStore();
  expect(pick(s.getState(), view, 0, 0)?.snap).toBe("origin");
  expect(pick(s.getState(), view, -100, 0)?.id).toBe("world:x");
  expect(pick(s.getState(), view, 0, -100)?.id).toBe("world:y");
  const side: PickView = {
    origin: V(0, -1000, 0),
    project: (p) => ({
      x: p.x,
      y: p.z,
      depth: p.y + 1000,
      visible: p.y > -1000,
    }),
    ray: (x, y) => ({ origin: V(x, -1000, y), direction: V(0, 1, 0) }),
  };
  expect(pick(s.getState(), side, 0, 100)?.id).toBe("world:z");
  expect(pick(s.getState(), side, 0, 100)?.point).toEqual(V(0, 0, 100));
});
it("reference and midpoint snaps respect foreground occlusion", () => {
  const s = rectangle(100);
  s.execute({ type: "guide", origin: V(0, 20, 99), direction: V(1) });
  s.execute({ type: "draw", segments: [[V(-10, 30, 99), V(10, 30, 99)]] });
  expect(pick(s.getState(), view, 0, 20)?.kind).toBe("face");
  expect(pick(s.getState(), view, 0, 30)?.kind).toBe("face");
});
