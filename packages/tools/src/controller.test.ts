import { beforeAll, it, expect } from "vitest";
import { initializeGeometry, V } from "@gabarito/geometry";
import { createStore, faces, vertices } from "@gabarito/core";
import { createController } from "./index";
import type { ToolView, ToolHit } from "./index";
beforeAll(initializeGeometry);
function setup() {
  const store = createStore();
  let hit: ToolHit | null = null;
  const view: ToolView = {
    ray: (x, y) => ({ origin: V(x, y, 1000), direction: V(0, 0, -1) }),
    project: (p) => ({ x: p.x, y: p.y, visible: true }),
    pick: () => hit,
    preview: () => {},
  };
  const controller = createController(store, view);
  return {
    store,
    controller,
    hit: (h: ToolHit | null) => {
      hit = h;
    },
  };
}
it("creates an exact typed rectangle without clicking the dimensions input", () => {
  const { store, controller: c } = setup();
  c.setTool("rectangle");
  c.pointer(0, 0, true);
  for (const k of "100,50") c.key(k);
  c.key("Enter");
  expect(faces(store.getState())).toHaveLength(1);
  expect(Math.max(...vertices(store.getState()).map((v) => v.position.x))).toBe(
    100,
  );
  expect(Math.max(...vertices(store.getState()).map((v) => v.position.y))).toBe(
    50,
  );
});
it("keeps invalid input active without changing the document", () => {
  const { store, controller: c } = setup();
  c.setTool("rectangle");
  c.pointer(0, 0, true);
  c.setTyped("0,20");
  c.submit();
  expect(c.status().active).toBe(true);
  expect(c.status().message).toMatch(/nonzero/);
  expect(vertices(store.getState())).toHaveLength(0);
});
it("closes a line polygon and resets the chain", () => {
  const { store, controller: c } = setup();
  c.setTool("line");
  for (const [x, y] of [
    [0, 0],
    [100, 0],
    [0, 100],
    [0, 0],
  ])
    c.pointer(x, y, true);
  expect(faces(store.getState())).toHaveLength(1);
  expect(c.status().active).toBe(false);
});
it.each([
  ["ArrowUp", "z"],
  ["ArrowRight", "x"],
  ["ArrowLeft", "y"],
] as const)("%s constrains a typed line to %s", (key, axis) => {
  const { store, controller: c } = setup();
  c.setTool("line");
  c.pointer(0, 0, true);
  c.key(key);
  c.setTyped("10");
  c.submit();
  const ps = vertices(store.getState()).map((v) => v.position);
  expect(Math.max(...ps.map((p) => p[axis]))).toBe(10);
  for (const a of ["x", "y", "z"] as const)
    if (a !== axis) expect(ps.every((p) => p[a] === 0)).toBe(true);
  c.key(key);
  expect(c.status().axis).toBe("Free");
});
it("moves the selected topology along a pinned height axis", () => {
  const { store, controller: c } = setup();
  c.setTool("rectangle");
  c.pointer(0, 0, true);
  c.setTyped("100,100");
  c.submit();
  store.select([faces(store.getState())[0].id]);
  c.setTool("move");
  c.pointer(0, 0, true);
  c.key("ArrowUp");
  c.setTyped("10");
  c.submit();
  expect(vertices(store.getState()).every((v) => v.position.z === 10)).toBe(
    true,
  );
});
it("rotates a selection using an angle entered after its pivot", () => {
  const { store, controller: c } = setup();
  c.setTool("rectangle");
  c.pointer(0, 0, true);
  c.setTyped("100,50");
  c.submit();
  store.select([faces(store.getState())[0].id]);
  c.setTool("rotate");
  c.pointer(0, 0, true);
  c.setTyped("90");
  c.submit();
  expect(
    Math.max(...vertices(store.getState()).map((v) => v.position.y)),
  ).toBeCloseTo(100);
  expect(
    Math.min(...vertices(store.getState()).map((v) => v.position.x)),
  ).toBeCloseTo(-50);
});
it("supports a typed push/pull and one-step undo", () => {
  const { store, controller: c, hit } = setup();
  c.setTool("rectangle");
  c.pointer(0, 0, true);
  c.setTyped("100,100");
  c.submit();
  const face = faces(store.getState())[0];
  hit({ id: face.id, kind: "face", point: V(50, 50) });
  c.setTool("pushpull");
  c.pointer(50, 50, true);
  c.setTyped("10");
  c.submit();
  expect(faces(store.getState())).toHaveLength(6);
  c.key("z", true);
  expect(faces(store.getState())).toHaveLength(1);
  c.key("z", true, true);
  expect(faces(store.getState())).toHaveLength(6);
});
