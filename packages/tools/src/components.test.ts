import { beforeAll, expect, it } from "vitest";
import { V, initializeGeometry } from "@gabarito/geometry";
import {
  createStore,
  faces,
  vertices,
  selectionGeometry,
} from "@gabarito/core";
import { createController } from "./controller";
import { scaleBox } from "./scale-box";
import type { ToolView, ToolHit } from "./types";
beforeAll(initializeGeometry);
function setup() {
  const store = createStore(),
    p = [V(), V(100), V(100, 100), V(0, 100)];
  store.execute({
    type: "draw",
    segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
  });
  store.execute({
    type: "make-component",
    ids: Object.keys(store.getState().entities),
    name: "Panel",
  });
  const id = store.getState().selection[0];
  let hit: ToolHit | null = {
    id: faces(store.getScene())[0].id,
    kind: "face",
    point: V(50, 50),
  };
  let preview: Parameters<ToolView["preview"]>[0] = [];
  const view: ToolView = {
    ray: (x, y) => ({ origin: V(x, y, 1000), direction: V(0, 0, -1) }),
    project: (p) => ({ x: p.x, y: p.y, visible: true }),
    visible: () => true,
    pick: () => hit,
    preview: (lines) => {
      preview = lines;
    },
    cursorHint: () => {},
    feedback: () => {},
  };
  const c = createController(store, view);
  return {
    store,
    c,
    id,
    aim: (h: ToolHit | null) => {
      hit = h;
    },
    lines: () => preview,
  };
}
it("single click selects an atomic instance and double click enters its scope", () => {
  const { store, c, id, aim } = setup();
  c.pointer(50, 50, true);
  expect(store.getState().selection).toEqual([id]);
  c.pointer(50, 50, true, false, 2);
  expect(store.getContext().path).toEqual([id]);
  aim({ id: faces(store.getState())[0].id, kind: "face", point: V(50, 50) });
  c.pointer(50, 50, true, false, 2);
  expect(store.getState().selection).toHaveLength(9);
  c.key("Escape");
  expect(store.getContext().path).toEqual([]);
  expect(store.getState().selection).toEqual([id]);
  c.dispose();
});
it("outside Push/Pull cannot modify a component face", () => {
  const { store, c } = setup();
  const before = structuredClone(store.getState());
  c.setTool("pushpull");
  c.pointer(50, 50, true);
  c.setTyped("20");
  c.submit();
  expect(store.getState()).toEqual(before);
  expect(c.status().active).toBe(false);
  c.dispose();
});
it("a drawing snaps to a component surface but changes only the active scope", () => {
  const { store, c } = setup();
  c.setTool("rectangle");
  c.pointer(50, 50, true);
  c.setTyped("10,10");
  c.submit();
  expect(faces(store.getState())).toHaveLength(1);
  expect(faces(store.getScene())).toHaveLength(2);
  c.dispose();
});
it("move previews and transforms the whole selected instance without changing its definition", () => {
  const { store, c, id, aim, lines } = setup();
  const before = structuredClone(store.getState().definitions);
  c.setTool("move");
  c.pointer(50, 50, true);
  aim(null);
  c.pointer(150, 50);
  expect(lines()).toHaveLength(4);
  c.pointer(150, 50, true);
  expect(store.getState().definitions).toEqual(before);
  const e = store.getState().entities[id];
  expect(e.kind === "component" && e.transform.origin.x).toBeCloseTo(100);
  c.dispose();
});
it("component bounds expose scale handles while geometry stays scoped", () => {
  const { store, c } = setup();
  expect(vertices(store.getState())).toHaveLength(0);
  expect(vertices(selectionGeometry(store.getState()))).toHaveLength(4);
  const box = scaleBox(store.getState());
  expect(box?.grips).toHaveLength(8);
  expect(box?.max).toEqual(V(100, 100));
  c.dispose();
});
it("Escape cancels a tool first and exits the component only on the next Escape", () => {
  const { store, c, id, aim } = setup();
  store.enterComponent(id);
  aim({ id: faces(store.getState())[0].id, kind: "face", point: V(50, 50) });
  c.setTool("rectangle");
  c.pointer(50, 50, true);
  c.key("Escape");
  expect(store.getContext().path).toEqual([id]);
  expect(c.status().active).toBe(false);
  c.key("Escape");
  expect(store.getContext().path).toEqual([]);
  c.dispose();
});
it("Delete removes only the selected scene instance and undo restores it", () => {
  const { store, c, id } = setup();
  const before = structuredClone(store.getState());
  c.pointer(50, 50, true);
  c.key("Delete");
  expect(store.getState().entities[id]).toBeUndefined();
  expect(store.getState().definitions).toEqual(before.definitions);
  c.key("z", true);
  expect(store.getState().entities).toEqual(before.entities);
  c.dispose();
});
it("double-click outside geometry or empty space exits one context without changing definitions", () => {
  const { store, c, id, aim } = setup();
  const definition = Object.keys(store.getState().definitions)[0];
  store.execute({ type: "place-component", definition, point: V(200) });
  store.enterComponent(id);
  const before = structuredClone(store.getState().definitions);
  const outside = faces(store.getScene()).find((f) => f.id.includes("/"))!;
  aim({ id: outside.id, kind: "face", point: V(250, 50) });
  c.pointer(250, 50, true, false, 2);
  expect(store.getContext().path).toEqual([]);
  expect(store.getState().definitions).toEqual(before);
  store.enterComponent(id);
  aim(null);
  c.pointer(500, 500, true, false, 1);
  expect(store.getContext().path).toEqual([id]);
  c.pointer(500, 500, true, false, 2);
  expect(store.getContext().path).toEqual([]);
  c.dispose();
});
