import { beforeAll, expect, it } from "vitest";
import { V, sub, unit, initializeGeometry, near } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { createStore, faces, vertices, edges } from "@gabarito/core";
import { createController } from "./controller";
import { scaleBox } from "./scale-box";
import type { ToolView } from "./types";
beforeAll(initializeGeometry);
function setup(solid = false) {
  const store = createStore(),
    ps = [V(), V(100, 0), V(100, 50), V(0, 50)];
  store.execute({
    type: "draw",
    segments: ps.map((p, i) => [p, ps[(i + 1) % 4]]),
  });
  if (solid)
    store.execute({
      type: "pushpull",
      face: faces(store.getState())[0].id,
      distance: 80,
    });
  store.select(Object.keys(store.getState().entities));
  let handles: { id: string; point: Vec3; label: string }[] = [],
    lines: Parameters<ToolView["preview"]>[0] = [],
    hint = "",
    visible = true;
  let aim = V(),
    eye = V(300, -450, 350);
  const view: ToolView = {
    ray: () => ({ origin: eye, direction: unit(sub(aim, eye)) }),
    project: (p) => ({ x: p.x + p.y * 0.3, y: p.z + p.y * 0.2, visible: true }),
    visible: () => visible,
    pick: () => null,
    feedback: () => {},
    preview: (l) => {
      lines = l;
    },
    cursorHint: (t) => {
      hint = t;
    },
    handles: (h) => {
      handles = h;
    },
  };
  const c = createController(store, view);
  c.setTool("scale");
  return {
    store,
    c,
    view,
    handles: () => handles,
    lines: () => lines,
    hint: () => hint,
    aim: (p: Vec3) => {
      aim = p;
    },
    hide: () => {
      visible = false;
    },
    eye: (p: Vec3) => {
      eye = p;
    },
    press: (id: string) => {
      const h = handles.find((h) => h.id === id)!;
      aim = h.point;
      const p = view.project(h.point);
      c.press(p.x, p.y);
      c.release(p.x, p.y);
    },
  };
}
it("shows tight 26-grip solid bounds, 8-grip flat bounds and no artificial thickness", () => {
  for (const solid of [true, false]) {
    const { store, c, handles, lines } = setup(solid),
      box = scaleBox(store.getState())!;
    expect(handles()).toHaveLength(solid ? 26 : 8);
    expect(lines()).toHaveLength(solid ? 12 : 4);
    expect(box.min).toEqual(V());
    expect(box.max).toEqual(V(100, 50, solid ? 80 : 0));
    c.setTool("select");
    expect(handles()).toEqual([]);
    expect(lines()).toEqual([]);
  }
});
it("stretches a face handle about its opposite anchor with preview and exact history", () => {
  const { store, c, aim, press, lines } = setup(true),
    before = structuredClone(store.getState().entities);
  press("1,0,0");
  expect(c.status().active).toBe(true);
  expect(store.getState().entities).toEqual(before);
  aim(V(150, 25, 40));
  c.pointer(0, 0);
  expect(c.status().measurement).toContain("1.500");
  expect(
    lines().some((l) => l.some((p) => Math.abs(p.x - 150) < 0.00001)),
  ).toBe(true);
  expect(store.getState().entities).toEqual(before);
  c.press(10, 10);
  c.release(10, 10);
  expect(
    Math.max(...vertices(store.getState()).map((v) => v.position.x)),
  ).toBeCloseTo(150);
  expect(Math.max(...vertices(store.getState()).map((v) => v.position.y))).toBe(
    50,
  );
  expect(Math.max(...vertices(store.getState()).map((v) => v.position.z))).toBe(
    80,
  );
  const after = structuredClone(store.getState().entities);
  store.undo();
  expect(store.getState().entities).toEqual(before);
  store.redo();
  expect(store.getState().entities).toEqual(after);
});
it("drags an edge handle to distort two dimensions independently", () => {
  const { store, c, view, aim, handles } = setup(true),
    h = handles().find((h) => h.id === "1,-1,0")!,
    p = view.project(h.point);
  aim(h.point);
  c.press(p.x, p.y);
  aim(V(150, -50, 40));
  c.pointer(p.x + 30, p.y + 30);
  c.release(p.x + 30, p.y + 30);
  const ps = vertices(store.getState()).map((v) => v.position);
  expect(Math.max(...ps.map((p) => p.x))).toBeCloseTo(150);
  expect(Math.min(...ps.map((p) => p.y))).toBeCloseTo(-50);
  expect(Math.max(...ps.map((p) => p.z))).toBe(80);
});
it("scales a corner proportionally by typed factor and keeps the opposite corner fixed", () => {
  const { store, c, press } = setup(true);
  press("1,1,1");
  c.setTyped("2");
  c.submit();
  const ps = vertices(store.getState()).map((v) => v.position);
  expect(ps.some((p) => near(p, V()))).toBe(true);
  expect(ps.some((p) => near(p, V(200, 100, 160)))).toBe(true);
});
it("cancels without mutation, refreshes bounds on selection/history, and disposes subscriptions", () => {
  const { store, c, press, aim, handles } = setup(true),
    before = structuredClone(store.getState().entities);
  press("1,0,0");
  aim(V(170, 25, 40));
  c.pointer(0, 0);
  c.key("Escape");
  expect(store.getState().entities).toEqual(before);
  expect(c.status().active).toBe(false);
  expect(handles()).toHaveLength(26);
  press("1,0,0");
  store.select([]);
  expect(c.status().active).toBe(false);
  expect(handles()).toEqual([]);
  expect(c.status().message).toMatch(/Select geometry/);
  c.dispose();
  store.select(Object.keys(before));
  expect(handles()).toEqual([]);
});
it("cannot grab hidden grips and rejects collapse, negative and nonfinite factors", () => {
  const { store, c, press, aim, hide } = setup(true),
    before = structuredClone(store.getState().entities);
  hide();
  press("1,0,0");
  expect(c.status().active).toBe(false);
  c.dispose();
  const next = setup(true);
  next.press("1,0,0");
  for (const input of ["0", "-1", "Infinity", "1,2"]) {
    next.c.setTyped(input);
    next.c.submit();
    expect(next.c.status().message).toMatch(/positive/);
  }
  next.c.setTyped("");
  next.aim(V(-10, 25, 40));
  next.c.pointer(10, 10);
  next.c.press(20, 20);
  next.c.release(20, 20);
  expect(next.store.getState().entities).toEqual(before);
  expect(next.c.status().message).toMatch(/positive/);
  aim(V());
  expect(store.getState().entities).toEqual(before);
});
it("supports flat and line selections and explains a single vertex selection", () => {
  const { store, c, press } = setup();
  press("1,1,0");
  c.setTyped("2");
  c.submit();
  expect(vertices(store.getState()).every((v) => v.position.z === 0)).toBe(
    true,
  );
  store.select([edges(store.getState())[0].id]);
  expect(scaleBox(store.getState())!.grips).toHaveLength(2);
  expect(scaleBox(store.getState())!.lines).toHaveLength(1);
  store.select([vertices(store.getState())[0].id]);
  expect(c.status().message).toMatch(/no extent/);
  expect(scaleBox(store.getState())!.grips).toEqual([]);
});
it("does not commit stale factors when the camera ray becomes parallel to an edge grip plane", () => {
  const { store, c, press, view } = setup(true),
    before = structuredClone(store.getState().entities);
  press("1,-1,0");
  view.ray = () => ({ origin: V(0, 0, 500), direction: V(1, 0, 0) });
  c.press(10, 10);
  c.release(10, 10);
  expect(store.getState().entities).toEqual(before);
  expect(c.status().message).toMatch(/Orbit/);
});
