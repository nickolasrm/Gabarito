import { beforeAll, it, expect } from "vitest";
import {
  initializeGeometry,
  V,
  sub,
  unit,
  rotate,
  near,
  dot,
} from "@gabarito/geometry";
import {
  createStore,
  faces,
  vertices,
  edges,
  position,
  loops,
  edgeKey,
} from "@gabarito/core";
import { createController } from "./index";
import type { ToolView, ToolHit } from "./index";
beforeAll(initializeGeometry);
function setup() {
  const store = createStore();
  let hit: ToolHit | null = null;
  let feedback: ToolHit | null = null;
  const view: ToolView = {
    ray: (x, y) => ({ origin: V(x, y, 1000), direction: V(0, 0, -1) }),
    project: (p) => ({ x: p.x, y: p.y, visible: true }),
    pick: () => hit,
    preview: () => {},
    feedback: (h) => {
      feedback = h;
    },
  };
  const controller = createController(store, view);
  return {
    store,
    controller,
    view,
    feedback: () => feedback,
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
  c.press(50, 50);
  c.setTyped("10");
  c.release(50, 50);
  expect(faces(store.getState())).toHaveLength(6);
  c.key("z", true);
  expect(faces(store.getState())).toHaveLength(1);
  c.key("z", true, true);
  expect(faces(store.getState())).toHaveLength(6);
});

function drawn() {
  const fixture = setup(),
    c = fixture.controller;
  c.setTool("rectangle");
  c.pointer(0, 0, true);
  c.setTyped("100,100");
  c.submit();
  return fixture;
}
it("previews while held, commits on release once and creates one undo entry", () => {
  const { store, controller: c, view, hit } = drawn();
  const id = faces(store.getState())[0].id;
  hit({ id, kind: "face", point: V(50, 50) });
  const eye = V(50, -500, 500);
  view.ray = (x, y) => ({
    origin: eye,
    direction: unit(sub(V(x, 50, y), eye)),
  });
  c.setTool("pushpull");
  c.press(50, 0);
  c.pointer(50, 20);
  expect(c.status().active).toBe(true);
  expect(faces(store.getState())).toHaveLength(1);
  c.release(50, 20);
  expect(c.status().active).toBe(false);
  expect(
    Math.max(...vertices(store.getState()).map((v) => v.position.z)),
  ).toBeCloseTo(20);
  const after = structuredClone(store.getState());
  c.release(50, 20);
  expect(store.getState()).toEqual(after);
  store.undo();
  expect(faces(store.getState())).toHaveLength(1);
  store.undo();
  expect(faces(store.getState())).toHaveLength(0);
});
it("treats a stationary press/release as a no-op", () => {
  const { store, controller: c, hit } = drawn();
  hit({ id: faces(store.getState())[0].id, kind: "face", point: V(50, 50) });
  c.setTool("pushpull");
  const before = structuredClone(store.getState());
  c.press(50, 50);
  c.release(50, 50);
  expect(store.getState()).toEqual(before);
  expect(c.status().active).toBe(false);
  expect(c.status().message).toBe("");
});
it("Escape cancels a held extrusion and later release cannot commit", () => {
  const { store, controller: c, hit } = drawn();
  hit({ id: faces(store.getState())[0].id, kind: "face", point: V(50, 50) });
  c.setTool("pushpull");
  c.press(50, 50);
  c.setTyped("20");
  c.key("Escape");
  c.release(50, 50);
  expect(faces(store.getState())).toHaveLength(1);
  expect(c.status().active).toBe(false);
});
it("invalid typed release ends the gesture with an error and no mutation", () => {
  const { store, controller: c, hit } = drawn();
  hit({ id: faces(store.getState())[0].id, kind: "face", point: V(50, 50) });
  c.setTool("pushpull");
  const before = structuredClone(store.getState());
  c.press(50, 50);
  c.setTyped("0");
  c.release(50, 50);
  expect(store.getState()).toEqual(before);
  expect(c.status().active).toBe(false);
  expect(c.status().message).toContain("nonzero");
});
it("Enter during a held gesture commits without a duplicate on release", () => {
  const { store, controller: c, hit } = drawn();
  hit({ id: faces(store.getState())[0].id, kind: "face", point: V(50, 50) });
  c.setTool("pushpull");
  c.press(50, 50);
  c.setTyped("20");
  c.key("Enter");
  const before = structuredClone(store.getState());
  c.release(50, 50);
  expect(store.getState()).toEqual(before);
  store.undo();
  expect(faces(store.getState())).toHaveLength(1);
});
it("shows the actual vertex and edge snap position without changing the model", () => {
  const { store, controller: c, hit, feedback } = drawn();
  const m = structuredClone(store.getState()),
    vertex = vertices(m)[0],
    edge = edges(m)[0];
  c.setTool("line");
  hit({ id: vertex.id, kind: "vertex", point: vertex.position });
  c.pointer(3, 3);
  expect(feedback()).toEqual({
    id: vertex.id,
    kind: "vertex",
    point: vertex.position,
  });
  hit({ id: edge.id, kind: "edge", point: V(50) });
  c.pointer(50, 2);
  expect(feedback()?.point).toEqual(V(50));
  expect(store.getState()).toEqual(m);
  c.leave();
  expect(feedback()).toBeNull();
  c.pointer(50, 2);
  c.setTool("select");
  expect(feedback()).toBeNull();
});
it("hides a snap candidate when an axis lock makes it ineligible", () => {
  const { controller: c, hit, feedback } = drawn();
  c.setTool("line");
  hit(null);
  c.pointer(0, 0, true);
  c.key("ArrowRight");
  hit({ id: "vertex", kind: "vertex", point: V(50, 50) });
  c.pointer(50, 50);
  expect(feedback()).toBeNull();
});
it("single/double/triple clicks select face, face boundary and connected component", () => {
  const { store, controller: c, hit } = drawn();
  store.execute({
    type: "pushpull",
    face: faces(store.getState())[0].id,
    distance: 100,
  });
  store.execute({ type: "draw", segments: [[V(300), V(400)]] });
  const m = store.getState(),
    face = faces(m).find((f) =>
      f.outer.every((id) => position(m, id).z === 100),
    )!;
  c.setTool("select");
  hit({ id: face.id, kind: "face", point: V(50, 50, 100) });
  c.pointer(50, 50, true, false, 1);
  expect(store.getState().selection).toEqual([face.id]);
  c.pointer(50, 50, true, false, 2);
  const selected = new Set(store.getState().selection),
    boundary = new Set(
      loops(face).flatMap((l) =>
        l.map((a, i) => edgeKey(a, l[(i + 1) % l.length])),
      ),
    );
  expect(selected.size).toBe(9);
  expect(selected.has(face.id)).toBe(true);
  for (const id of face.outer) expect(selected.has(id)).toBe(true);
  for (const e of edges(m))
    expect(selected.has(e.id)).toBe(boundary.has(edgeKey(...e.vertices)));
  c.pointer(50, 50, true, false, 3);
  expect(store.getState().selection).toHaveLength(26);
  expect(
    store.getState().selection.every((id) => {
      const e = m.entities[id];
      return e.kind !== "vertex" || e.position.x < 300;
    }),
  ).toBe(true);
});
it("double-click includes hole boundaries but does not select the face inside the hole", () => {
  const { store, controller: c, hit } = drawn();
  c.setTool("rectangle");
  c.pointer(20, 20, true);
  c.setTyped("30,30");
  c.submit();
  const m = store.getState(),
    ring = faces(m).find((f) => f.holes.length)!,
    inner = faces(m).find((f) => !f.holes.length)!;
  c.setTool("select");
  hit({ id: ring.id, kind: "face", point: V(10, 10) });
  c.pointer(10, 10, true, false, 2);
  expect(store.getState().selection).toHaveLength(17);
  expect(store.getState().selection).not.toContain(inner.id);
  for (const id of ring.holes.flat())
    expect(store.getState().selection).toContain(id);
});
it("preserves Shift toggling and adds double-click boundaries to an existing selection", () => {
  const { store, controller: c, hit } = drawn();
  const face = faces(store.getState())[0];
  c.setTool("select");
  hit({ id: face.id, kind: "face", point: V(50, 50) });
  c.pointer(50, 50, true, true, 1);
  expect(store.getState().selection).toEqual([face.id]);
  c.pointer(50, 50, true, true, 1);
  expect(store.getState().selection).toEqual([]);
  store.execute({ type: "draw", segments: [[V(300), V(400)]] });
  const outside = vertices(store.getState()).find(
    (v) => v.position.x > 200,
  )!.id;
  store.select([outside]);
  c.pointer(50, 50, true, true, 2);
  expect(store.getState().selection).toHaveLength(10);
  expect(store.getState().selection).toContain(outside);
});
it("fills a deleted vertical opening from snapped opposite vertices with a rectangular preview", () => {
  const { store, controller: c, view, hit } = setup();
  const drawLoop = (ps: ReturnType<typeof V>[]) =>
    store.execute({
      type: "draw",
      segments: ps.map((p, i) => [p, ps[(i + 1) % ps.length]]),
    });
  drawLoop([V(), V(100), V(100, 0, 100), V(0, 0, 100)]);
  const inner = [V(20, 0, 20), V(80, 0, 20), V(80, 0, 80), V(20, 0, 80)];
  drawLoop(inner);
  store.execute({
    type: "delete",
    ids: [faces(store.getState()).find((f) => !f.holes.length)!.id],
  });
  let preview: ReturnType<typeof V>[][] = [];
  view.preview = (ps) => {
    preview = ps;
  };
  const a = vertices(store.getState()).find(
      (v) => v.position.x === 20 && v.position.z === 80,
    )!,
    b = vertices(store.getState()).find(
      (v) => v.position.x === 80 && v.position.z === 20,
    )!;
  c.setTool("rectangle");
  hit({ id: a.id, kind: "vertex", point: a.position });
  c.pointer(0, 0, true);
  hit({ id: b.id, kind: "vertex", point: b.position });
  c.pointer(1, 1);
  expect(new Set(preview.flat().map((p) => JSON.stringify(p))).size).toBe(4);
  expect(preview.flat().every((p) => Math.abs(p.y) < 1e-5)).toBe(true);
  const before = structuredClone(store.getState().entities);
  c.pointer(1, 1, true);
  expect(c.status().message).toBe("");
  expect(c.status().active).toBe(false);
  const restored = faces(store.getState()).find((f) => !f.holes.length)!;
  expect(restored.outer).toHaveLength(4);
  expect(edges(store.getState())).toHaveLength(8);
  store.undo();
  expect(store.getState().entities).toEqual(before);
  store.redo();
  expect(faces(store.getState())).toHaveLength(2);
});

for (const bare of [false, true])
  it(`draws a rectangle across a rotated ${bare ? "wire opening" : "face opening"}`, () => {
    const { store, controller: c, view, hit } = setup(),
      transform = (p: ReturnType<typeof V>) =>
        rotate(p, V(), V(1, 2, 3), Math.PI / 5);
    const outer = [V(), V(100), V(100, 0, 100), V(0, 0, 100)].map(transform),
      inner = [V(20, 0, 20), V(80, 0, 20), V(80, 0, 80), V(20, 0, 80)].map(
        transform,
      );
    for (const ps of [outer, inner])
      store.execute({
        type: "draw",
        segments: ps.map((p, i) => [p, ps[(i + 1) % ps.length]]),
      });
    store.execute({
      type: "delete",
      ids: faces(store.getState())
        .filter((f) => bare || !f.holes.length)
        .map((f) => f.id),
    });
    const a = vertices(store.getState()).find((v) =>
        near(v.position, inner[3]),
      )!,
      b = vertices(store.getState()).find((v) => near(v.position, inner[1]))!;
    let preview: ReturnType<typeof V>[][] = [];
    view.preview = (ps) => {
      preview = ps;
    };
    c.setTool("rectangle");
    hit({ id: a.id, kind: "vertex", point: a.position });
    c.pointer(0, 0, true);
    hit({ id: b.id, kind: "vertex", point: b.position });
    c.pointer(1, 1);
    expect(preview).toHaveLength(4);
    for (const p of inner)
      expect(preview.flat().some((q) => near(p, q))).toBe(true);
    expect(
      dot(
        unit(sub(preview[0][1], preview[0][0])),
        unit(sub(preview[1][1], preview[1][0])),
      ),
    ).toBeCloseTo(0);
    c.pointer(1, 1, true);
    expect(c.status().message).toBe("");
    expect(faces(store.getState()).filter((f) => !f.holes.length)).toHaveLength(
      1,
    );
  });
it("infers a vertical rectangle from edge targets instead of projecting them onto ground", () => {
  const { store, controller: c, hit } = setup(),
    ps = [V(), V(100), V(100, 0, 100), V(0, 0, 100)];
  store.execute({
    type: "draw",
    segments: ps.map((p, i) => [p, ps[(i + 1) % ps.length]]),
  });
  const bottom = edges(store.getState()).find((e) =>
      e.vertices.every((id) => position(store.getState(), id).z === 0),
    )!,
    top = edges(store.getState()).find((e) =>
      e.vertices.every((id) => position(store.getState(), id).z === 100),
    )!;
  c.setTool("rectangle");
  hit({ id: bottom.id, kind: "edge", point: V(20) });
  c.pointer(20, 0, true);
  hit({ id: top.id, kind: "edge", point: V(80, 0, 100) });
  c.pointer(80, 100, true);
  expect(c.status().message).toBe("");
  expect(faces(store.getState())).toHaveLength(3);
  expect(
    vertices(store.getState()).every((v) => Math.abs(v.position.y) < 1e-5),
  ).toBe(true);
});

it("keeps an isolated starting vertex and hides an unsupported off-plane target", () => {
  const { store, controller: c, view, hit, feedback } = setup();
  store.execute({ type: "draw", segments: [[V(0, 0, 10), V(100, 100, 20)]] });
  const [a, b] = vertices(store.getState());
  store.execute({
    type: "delete",
    ids: edges(store.getState()).map((e) => e.id),
  });
  let preview: ReturnType<typeof V>[][] = [];
  view.preview = (ps) => {
    preview = ps;
  };
  c.setTool("rectangle");
  hit({ id: a.id, kind: "vertex", point: a.position });
  c.pointer(0, 0, true);
  hit({ id: b.id, kind: "vertex", point: b.position });
  c.pointer(100, 100);
  expect(preview.flat().every((p) => Math.abs(p.z - 10) < 1e-5)).toBe(true);
  expect(feedback()).toBeNull();
});
