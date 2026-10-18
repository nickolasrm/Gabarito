import { beforeAll, expect, it } from "vitest";
import {
  V,
  initializeGeometry,
  unit,
  add,
  mul,
  sub,
  dot,
  length,
  cross,
  near,
} from "@gabarito/geometry";
import type { Segment } from "@gabarito/geometry";
import { createStore, faces, vertices, edges, surface } from "@gabarito/core";
import { createController } from "./controller";
import type { ToolHit, ToolView } from "./types";
beforeAll(initializeGeometry);
function setup(origin = V(), u = V(1, 0, 0), v = V(0, 1, 0), face = false) {
  const store = createStore(),
    n = unit(cross(u, v)),
    point = (x: number, y: number) => add(origin, add(mul(u, x), mul(v, y)));
  if (face) {
    const ps = [point(0, 0), point(100, 0), point(100, 100), point(0, 100)];
    store.execute({
      type: "draw",
      segments: ps.map((p, i) => [p, ps[(i + 1) % 4]]),
    });
  }
  let hit: ToolHit | null = null,
    lines: Segment[] = [],
    hint = "",
    feedback: ToolHit | null = null;
  const view: ToolView = {
    ray: (x, y) => ({
      origin: add(point(x, y), mul(n, 1000)),
      direction: mul(n, -1),
    }),
    project: (p) => ({
      x: dot(sub(p, origin), u),
      y: dot(sub(p, origin), v),
      visible: true,
    }),
    visible: () => true,
    pick: (x, y, faceOnly) =>
      faceOnly && hit?.kind === "vertex"
        ? face
          ? {
              id: faces(store.getState())[0].id,
              kind: "face",
              point: point(x, y),
            }
          : null
        : hit,
    preview: (p) => {
      lines = p;
    },
    feedback: (p) => {
      feedback = p;
    },
    cursorHint: (t) => {
      hint = t;
    },
  };
  const c = createController(store, view);
  return {
    store,
    c,
    view,
    point,
    lines: () => lines,
    hint: () => hint,
    feedback: () => feedback,
    aim(x: number, y: number) {
      hit = face
        ? {
            id: faces(store.getState())[0].id,
            kind: "face",
            point: point(x, y),
          }
        : null;
    },
    hit: (h: ToolHit | null) => {
      hit = h;
    },
  };
}
for (const [name, origin, u, v] of [
  ["ground", V(), V(1, 0, 0), V(0, 1, 0)],
  ["vertical", V(100, 0, 0), V(0, 1, 0), V(0, 0, 1)],
  ["tilted", V(20, 30, 40), unit(V(1, 1, 0)), unit(V(-1, 1, 2))],
] as const) {
  it(`draws a typed circle with an exact radius on a ${name} supporting face`, () => {
    const { store, c, point, aim } = setup(origin, u, v, true),
      before = structuredClone(store.getState().entities);
    c.setTool("circle");
    aim(50, 50);
    c.pointer(50, 50, true);
    c.setTyped("10");
    c.submit();
    expect(faces(store.getState())).toHaveLength(2);
    const circle = faces(store.getState()).find((f) => f.outer.length === 24)!;
    for (const p of surface(store.getState(), circle).outer)
      expect(length(sub(p, point(50, 50)))).toBeCloseTo(10, 5);
    const after = structuredClone(store.getState().entities);
    store.undo();
    expect(store.getState().entities).toEqual(before);
    store.redo();
    expect(store.getState().entities).toEqual(after);
  });
}
it("previews a snapped circle radius, supports Alt, segment settings and unit entry", () => {
  const { store, c, point, aim, lines, hint, feedback, hit } = setup(
    V(),
    V(1, 0, 0),
    V(0, 1, 0),
    true,
  );
  const before = structuredClone(store.getState().entities);
  c.setTool("circle");
  c.setCircleSegments(32);
  aim(49, 49);
  c.pointer(49, 49);
  expect(hint()).toContain("Reference intersection");
  expect(near(feedback()!.point, point(50, 50))).toBe(true);
  c.pointer(49, 49, true);
  hit({ id: "target", kind: "vertex", point: point(70, 50) });
  c.pointer(69, 50);
  expect(hint()).toContain("Radius 20.00");
  expect(lines()).toHaveLength(33);
  expect(store.getState().entities).toEqual(before);
  c.setSnapping(false);
  expect(c.status().measurement).toContain("19.00");
  c.setSnapping(true);
  c.setTyped("2cm");
  c.submit();
  expect(faces(store.getState()).some((f) => f.outer.length === 32)).toBe(true);
  for (const n of [0, 2, 257, 3.5, NaN]) {
    c.setCircleSegments(n);
    expect(c.status().circleSegments).toBe(32);
  }
});
it("draws circle geometry on click and keeps unsupported off-plane targets out of its frozen plane", () => {
  const { store, c, hit, hint } = setup();
  c.setTool("circle");
  c.pointer(0, 0, true);
  hit({ id: "offplane", kind: "vertex", point: V(10, 0, 50) });
  c.pointer(10, 0);
  expect(hint()).toContain("10.00");
  c.pointer(10, 0, true);
  expect(vertices(store.getState())).toHaveLength(24);
  expect(vertices(store.getState()).every((v) => v.position.z === 0)).toBe(
    true,
  );
});
it("rejects invalid circle radii, clears previews on cancellation and uses explicit vertical planes", () => {
  const { store, c, view, lines } = setup();
  c.setTool("circle");
  c.pointer(0, 0, true);
  for (const input of ["0", "-10", "Infinity"]) {
    c.setTyped(input);
    c.submit();
    expect(faces(store.getState())).toHaveLength(0);
  }
  c.key("Escape");
  expect(lines()).toEqual([]);
  c.key("ArrowUp");
  view.ray = (x, y) => ({ origin: V(x, -1000, y), direction: V(0, 1, 0) });
  c.pointer(0, 0, true);
  c.setTyped("10");
  c.submit();
  expect(
    vertices(store.getState()).every((v) => Math.abs(v.position.y) < 1e-5),
  ).toBe(true);
  expect(
    Math.max(...vertices(store.getState()).map((v) => v.position.z)),
  ).toBeCloseTo(10);
});
it("offset previews are transient and typed units partition a rectangle exactly", () => {
  const { store, c, aim, lines, hint } = setup(
      V(),
      V(1, 0, 0),
      V(0, 1, 0),
      true,
    ),
    before = structuredClone(store.getState().entities);
  c.setTool("offset");
  aim(30, 30);
  c.pointer(30, 30, true);
  aim(10, 40);
  c.pointer(10, 40);
  expect(lines().length).toBeGreaterThanOrEqual(4);
  expect(hint()).toContain("Offset 10.00");
  expect(store.getState().entities).toEqual(before);
  c.setTyped("1cm");
  c.submit();
  expect(faces(store.getState())).toHaveLength(2);
  expect(
    vertices(store.getState()).some((v) => near(v.position, V(10, 10))),
  ).toBe(true);
  const after = structuredClone(store.getState().entities);
  store.undo();
  expect(store.getState().entities).toEqual(before);
  store.redo();
  expect(store.getState().entities).toEqual(after);
});
it("offset click completion uses face references with Alt bypass and keeps its source plane", () => {
  const { store, c, aim, hint, view, point } = setup(
    V(100, 0, 0),
    V(0, 1, 0),
    V(0, 0, 1),
    true,
  );
  c.setTool("offset");
  aim(20, 20);
  c.pointer(20, 20, true);
  aim(11, 49);
  c.pointer(11, 49);
  expect(hint()).toContain("Midpoint alignment");
  c.setSnapping(false);
  expect(hint()).not.toContain("Midpoint alignment");
  c.setSnapping(true);
  c.pointer(11, 49, true);
  expect(faces(store.getState())).toHaveLength(2);
  const inner = faces(store.getState()).find((f) => !f.holes.length)!;
  expect(
    surface(store.getState(), inner).outer.every(
      (p) => Math.abs(p.x - 100) < 1e-5,
    ),
  ).toBe(true);
  expect(
    surface(store.getState(), inner).outer.some((p) => near(p, point(11, 11))),
  ).toBe(true);
  view.pick = () => null;
});
it("offset rejects collapse/outside input and cancels stale source selections or Escape", () => {
  const { store, c, aim, view, lines } = setup(
      V(),
      V(1, 0, 0),
      V(0, 1, 0),
      true,
    ),
    before = structuredClone(store.getState().entities);
  c.setTool("offset");
  aim(20, 20);
  c.pointer(20, 20, true);
  c.setTyped("60");
  c.submit();
  expect(c.status().message).toMatch(/large/);
  expect(store.getState().entities).toEqual(before);
  view.pick = () => null;
  c.pointer(150, 150, true);
  expect(store.getState().entities).toEqual(before);
  expect(c.status().message).toMatch(/positive/);
  store.select([faces(store.getState())[0].id]);
  expect(c.status().active).toBe(false);
  expect(lines()).toEqual([]);
  aim(20, 20);
  c.setTool("offset");
  c.key("Escape");
  expect(c.status().tool).toBe("select");
  expect(edges(store.getState())).toHaveLength(4);
});
