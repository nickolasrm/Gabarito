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
  let hint = "";
  const view: ToolView = {
    ray: (x, y) => ({ origin: V(x, y, 1000), direction: V(0, 0, -1) }),
    visible: () => true,
    project: (p) => ({ x: p.x, y: p.y, visible: true }),
    pick: () => hit,
    preview: () => {},
    cursorHint: (text) => {
      hint = text;
    },
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
    hint: () => hint,
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
  expect(c.status().axis).toBe("Free");
  c.key(key);
  expect(c.status().axis).toBe(axis.toUpperCase());
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
it("arms click-mode on a stationary press/release and zero-depth completion is a no-op", () => {
  const { store, controller: c, hit } = drawn();
  hit({ id: faces(store.getState())[0].id, kind: "face", point: V(50, 50) });
  c.setTool("pushpull");
  const before = structuredClone(store.getState());
  c.press(50, 50);
  c.release(50, 50);
  expect(store.getState()).toEqual(before);
  expect(c.status().active).toBe(true);
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
    expect(preview).toHaveLength(5);
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

it("tape measures click/click, shows selected units and creates an edge-parallel ruler only on completion", () => {
  const { store, controller: c, hit, hint } = setup();
  store.execute({ type: "draw", segments: [[V(0, 10), V(100, 10)]] });
  const edge = edges(store.getState())[0];
  c.setTool("tape");
  hit({ id: edge.id, kind: "edge", point: V(50, 10), snap: "midpoint" });
  c.press(50, 10);
  c.release(50, 10);
  expect(c.status().active).toBe(true);
  hit(null);
  c.pointer(50, 60);
  expect(hint()).toBe("50.00 mm");
  c.setUnit("cm");
  expect(hint()).toBe("5.00 cm");
  expect(
    Object.values(store.getState().entities).filter((e) => e.kind === "guide"),
  ).toHaveLength(0);
  c.press(50, 60);
  c.release(50, 60);
  const g = Object.values(store.getState().entities).find(
    (e) => e.kind === "guide",
  )!;
  expect(g.kind === "guide" && g.origin).toEqual(V(50, 60));
  expect(g.kind === "guide" && g.direction).toEqual(V(1));
  expect(hint()).toBe("");
  store.undo();
  expect(store.getState().entities[g.id]).toBeUndefined();
  store.redo();
  expect(store.getState().entities[g.id]).toEqual(g);
});
it("tape drags from a face to another hovered face with a full 3D measurement", () => {
  const { store, controller: c, hit, hint } = setup();
  c.setTool("tape");
  hit({ id: "face", kind: "face", point: V(10, 10, 10) });
  c.press(10, 10);
  hit({ id: "face2", kind: "face", point: V(10, 40, 50) });
  c.pointer(10, 40);
  expect(hint()).toBe("50.00 mm");
  c.release(10, 40);
  const g = Object.values(store.getState().entities).find(
    (e) => e.kind === "guide",
  )!;
  expect(g.kind === "guide" && g.direction).toEqual(V(0, 0.6, 0.8));
  expect(c.status().active).toBe(false);
});
it("tape accepts vertex and built-in ruler sources, cancels gestures and rejects empty starts", () => {
  const { store, controller: c, hit, hint } = setup();
  c.setTool("tape");
  c.press(10, 10);
  c.release(10, 10);
  expect(c.status().active).toBe(false);
  expect(c.status().message).toMatch(/Choose/);
  hit({ id: "world:origin", kind: "vertex", point: V() });
  c.press(0, 0);
  hit(null);
  c.pointer(30, 40);
  expect(hint()).toBe("50.00 mm");
  c.key("Escape");
  c.release(30, 40);
  expect(store.canUndo()).toBe(false);
  expect(hint()).toBe("");
  hit({ id: "world:z", kind: "guide", point: V(0, 0, 10) });
  c.press(0, 0);
  c.release(0, 0);
  hit(null);
  c.pointer(20, 20);
  c.setTool("line");
  expect(hint()).toBe("");
  expect(store.canUndo()).toBe(false);
});
it("tape vertex rulers follow the measured direction and zero-length completion is a no-op", () => {
  const { store, controller: c, hit } = setup();
  c.setTool("tape");
  hit({ id: "v", kind: "vertex", point: V(10, 10) });
  c.pointer(10, 10, true);
  c.pointer(10, 10, true);
  expect(store.canUndo()).toBe(false);
  c.pointer(10, 10, true);
  hit(null);
  c.pointer(40, 50, true);
  const g = Object.values(store.getState().entities).find(
    (e) => e.kind === "guide",
  )!;
  expect(g.kind === "guide" && g.direction).toEqual(V(0.6, 0.8));
});
it("rectangle ratio hints add a transient diagonal without adding document edges", () => {
  const { store, controller: c, view, hint } = setup();
  let lines: [ReturnType<typeof V>, ReturnType<typeof V>][] = [];
  view.preview = (p) => {
    lines = p;
  };
  c.setTool("rectangle");
  c.pointer(10, 10, true);
  for (const [x, y, label] of [
    [110, 110, "Square · 1:1"],
    [210, 110, "2:1"],
    [110, 310, "1:3"],
    [410, 110, "4:1"],
    [165, 110, ""],
  ] as const) {
    c.pointer(x, y);
    expect(hint()).toBe(label);
    expect(lines).toHaveLength(label ? 5 : 4);
  }
  c.pointer(210, 110, true);
  expect(edges(store.getState())).toHaveLength(4);
  expect(hint()).toBe("");
});

it("tape can offset an existing ruler without changing its direction", () => {
  const { store, controller: c, hit } = setup();
  store.execute({ type: "guide", origin: V(10, 10), direction: V(1, 1) });
  const source = Object.values(store.getState().entities).find(
    (e) => e.kind === "guide",
  )!;
  c.setTool("tape");
  hit({ id: source.id, kind: "guide", point: V(20, 20) });
  c.press(20, 20);
  c.release(20, 20);
  hit(null);
  c.press(20, 50);
  c.release(20, 50);
  const result = Object.values(store.getState().entities).filter(
    (e) => e.kind === "guide",
  );
  expect(result).toHaveLength(2);
  expect(result[1].kind === "guide" && result[1].direction.x).toBeCloseTo(
    Math.SQRT1_2,
  );
  expect(result[1].kind === "guide" && result[1].direction.y).toBeCloseTo(
    Math.SQRT1_2,
  );
});
it("moving a selected ruler previews its infinite reference and commits one transform", () => {
  const { store, controller: c, view } = setup();
  store.execute({ type: "guide", origin: V(10, 10), direction: V(1) });
  const id = Object.values(store.getState().entities)[0].id;
  store.select([id]);
  let rulers: unknown[] = [];
  view.preview = (_, refs = []) => {
    rulers = refs;
  };
  c.setTool("move");
  c.pointer(10, 10, true);
  c.pointer(20, 30);
  expect(rulers).toEqual([
    { id, kind: "guide", origin: V(20, 30), direction: V(1) },
  ]);
  c.pointer(20, 30, true);
  expect(store.getState().entities[id]).toMatchObject({ origin: V(20, 30) });
});

it("midpoint rulers preserve edge direction even when the snap is a virtual vertex", () => {
  const { store, controller: c, hit, view } = setup();
  store.execute({ type: "draw", segments: [[V(0, 10), V(100, 10)]] });
  const edge = edges(store.getState())[0];
  let previewRulers: { direction: ReturnType<typeof V> }[] = [];
  view.preview = (_, rulers = []) => {
    previewRulers = rulers;
  };
  c.setTool("tape");
  hit({
    id: "virtual:midpoint",
    kind: "vertex",
    snap: "midpoint",
    sourceEdge: edge.id,
    point: V(50, 10),
  });
  c.pointer(50, 10, true);
  hit(null);
  c.pointer(70, 60);
  expect(previewRulers).toHaveLength(1);
  expect(previewRulers[0].direction).toEqual(V(1));
  expect(
    Object.values(store.getState().entities).some((e) => e.kind === "guide"),
  ).toBe(false);
  c.pointer(70, 60, true);
  expect(
    Object.values(store.getState().entities).find((e) => e.kind === "guide"),
  ).toMatchObject({ direction: V(1) });
  expect(previewRulers).toHaveLength(0);
});
it("rectangle commits a midpoint-aligned endpoint and Alt restores the raw dimension", () => {
  for (const bypass of [false, true]) {
    const { store, controller: c, hit, hint } = setup();
    const ps = [V(), V(100), V(100, 100), V(0, 100)];
    store.execute({
      type: "draw",
      segments: ps.map((p, i) => [p, ps[(i + 1) % 4]]),
    });
    const face = faces(store.getState())[0];
    c.setTool("rectangle");
    hit({ id: face.id, kind: "face", point: V(30, 30) });
    c.pointer(30, 30, true);
    hit({ id: face.id, kind: "face", point: V(40, 49) });
    c.pointer(40, 49);
    if (bypass) c.setSnapping(false);
    else expect(hint()).toMatch(/Midpoint alignment/);
    c.pointer(40, 49, true);
    expect(
      vertices(store.getState()).some((v) =>
        near(v.position, V(40, bypass ? 49 : 50)),
      ),
    ).toBe(true);
  }
});
it("rectangle proportions snap the endpoint exactly, release Alt restores snapping, and typed values win", () => {
  const { store, controller: c, view, hint } = setup();
  let preview: [ReturnType<typeof V>, ReturnType<typeof V>][] = [];
  view.preview = (lines) => {
    preview = lines;
  };
  c.setTool("rectangle");
  c.pointer(0, 0, true);
  c.pointer(100, 98);
  expect(hint()).toBe("Square · 1:1");
  c.setSnapping(false);
  expect(hint()).toBe("");
  expect(preview.flat()).toContainEqual(V(100, 98));
  c.setSnapping(true);
  expect(hint()).toBe("Square · 1:1");
  c.setTyped("100,98");
  c.submit();
  expect(
    vertices(store.getState()).some((v) => near(v.position, V(100, 98))),
  ).toBe(true);
});

it("push/pull commits the referenced vertex level; Alt bypasses it and typed input wins", () => {
  for (const mode of ["snap", "alt", "typed"] as const) {
    const { store, controller: c, hit, view, hint } = drawn();
    const id = faces(store.getState())[0].id;
    const eye = V(50, -500, 500);
    view.ray = (x, y) => ({
      origin: eye,
      direction: unit(sub(V(x, 50, y), eye)),
    });
    hit({ id, kind: "face", point: V(50, 50) });
    c.setTool("pushpull");
    c.press(50, 0);
    hit(
      mode === "alt"
        ? null
        : { id: "target", kind: "vertex", point: V(100, 100, 30) },
    );
    if (mode === "alt") c.setSnapping(false);
    c.pointer(50, 28);
    if (mode === "snap") expect(hint()).toMatch(/Vertex level/);
    if (mode === "typed") c.setTyped("17");
    c.release(50, 28);
    expect(
      Math.max(...vertices(store.getState()).map((v) => v.position.z)),
    ).toBeCloseTo(mode === "snap" ? 30 : mode === "alt" ? 28 : 17);
  }
});
it("Alt bypasses automatic axis inference while explicit locks still apply", () => {
  const { store, controller: c } = setup();
  c.setTool("line");
  c.pointer(0, 0, true);
  c.setSnapping(false);
  c.pointer(10, 1, true);
  expect(
    vertices(store.getState()).some((v) => near(v.position, V(10, 1))),
  ).toBe(true);
  c.cancel();
  c.pointer(10, 1, true);
  c.key("ArrowRight");
  c.pointer(20, 3, true);
  expect(
    vertices(store.getState()).some((v) => near(v.position, V(20, 1))),
  ).toBe(true);
});

for (const gesture of ["click", "drag"] as const) {
  it(`tape ${gesture} uses shared face snaps in preview, commit and history, with Alt bypass`, () => {
    for (const [raw, expected] of [
      [V(40, 49), V(40, 50)],
      [V(25, 26), V(25.5, 25.5)],
      [V(49, 51), V(50, 50)],
    ])
      for (const bypass of [false, true]) {
        const { store, controller: c, hit, view, hint } = setup();
        const p = [V(), V(100), V(100, 100), V(0, 100)];
        store.execute({
          type: "draw",
          segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
        });
        const face = faces(store.getState())[0],
          before = structuredClone(store.getState().entities);
        let preview: [ReturnType<typeof V>, ReturnType<typeof V>][] = [],
          rulers: { origin: ReturnType<typeof V> }[] = [];
        view.preview = (lines, refs = []) => {
          preview = lines;
          rulers = refs;
        };
        c.setTool("tape");
        hit({ id: face.id, kind: "face", point: V(30, 30) });
        c.press(30, 30);
        if (gesture === "click") c.release(30, 30);
        if (bypass) c.setSnapping(false);
        hit({ id: face.id, kind: "face", point: raw });
        c.pointer(raw.x, raw.y);
        const target = bypass ? raw : expected;
        expect(preview.some((l) => near(l[1], target))).toBe(true);
        expect(near(rulers[0].origin, target)).toBe(true);
        if (!bypass) expect(hint()).toMatch(/alignment|diagonal|intersection/i);
        expect(store.getState().entities).toEqual(before);
        if (gesture === "click") c.press(raw.x, raw.y);
        c.release(raw.x, raw.y);
        const g = Object.values(store.getState().entities).find(
          (e) => e.kind === "guide",
        )!;
        expect(g.kind === "guide" && near(g.origin, target)).toBe(true);
        store.undo();
        expect(store.getState().entities).toEqual(before);
        store.redo();
        expect(store.getState().entities[g.id]).toEqual(g);
      }
  });
}
it("tape infers on the target face plane when measuring across faces", () => {
  const { store, controller: c, hit } = setup();
  for (const [x, z] of [
    [0, 0],
    [200, 20],
  ]) {
    const p = [V(x, 0, z), V(x + 100, 0, z), V(x + 100, 100, z), V(x, 100, z)];
    store.execute({
      type: "draw",
      segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
    });
  }
  const fs = faces(store.getState());
  c.setTool("tape");
  hit({ id: fs[0].id, kind: "face", point: V(30, 30) });
  c.press(30, 30);
  c.release(30, 30);
  hit({ id: fs[1].id, kind: "face", point: V(240, 49, 20) });
  c.press(240, 49);
  c.release(240, 49);
  expect(
    Object.values(store.getState().entities).find((e) => e.kind === "guide"),
  ).toMatchObject({ origin: V(240, 50, 20) });
});
it("push/pull supports click/move/click with snaps, one-step undo and no late-release duplicate", () => {
  const { store, controller: c, hit, view } = drawn();
  const before = structuredClone(store.getState().entities),
    id = faces(store.getState())[0].id;
  const eye = V(50, -500, 500);
  view.ray = (x, y) => ({
    origin: eye,
    direction: unit(sub(V(x, 50, y), eye)),
  });
  hit({ id, kind: "face", point: V(50, 50) });
  c.setTool("pushpull");
  c.press(50, 0);
  c.release(50, 0);
  expect(c.status().active).toBe(true);
  expect(store.getState().entities).toEqual(before);
  hit({ id: "target", kind: "vertex", point: V(100, 100, 30) });
  c.pointer(50, 28);
  c.press(50, 28);
  c.release(50, 28);
  expect(
    Math.max(...vertices(store.getState()).map((v) => v.position.z)),
  ).toBeCloseTo(30);
  const after = structuredClone(store.getState().entities);
  c.release(50, 28);
  expect(store.getState().entities).toEqual(after);
  store.undo();
  expect(store.getState().entities).toEqual(before);
  store.redo();
  expect(store.getState().entities).toEqual(after);
});
it("click-mode push/pull accepts typed input and Escape cancels a pending click operation", () => {
  const { store, controller: c, hit } = drawn();
  hit({ id: faces(store.getState())[0].id, kind: "face", point: V(50, 50) });
  c.setTool("pushpull");
  const before = structuredClone(store.getState().entities);
  c.press(50, 50);
  c.release(50, 50);
  c.key("Escape");
  c.release(50, 50);
  expect(store.getState().entities).toEqual(before);
  expect(c.status().active).toBe(false);
  c.press(50, 50);
  c.release(50, 50);
  c.setTyped("15");
  c.submit();
  expect(
    Math.max(...vertices(store.getState()).map((v) => v.position.z)),
  ).toBeCloseTo(15);
});
it("axis pins clear after committed segments, tool completion, Escape and tool changes", () => {
  const { store, controller: c } = setup();
  c.setTool("line");
  c.pointer(0, 0, true);
  c.key("ArrowRight");
  c.setTyped("10");
  c.submit();
  expect(c.status().axis).toBe("Free");
  c.pointer(10, 20, true);
  expect(
    vertices(store.getState()).some((v) => near(v.position, V(10, 20))),
  ).toBe(true);
  c.key("ArrowDown");
  expect(c.status().axis).toContain("−");
  c.key("Escape");
  expect(c.status().axis).toBe("Free");
  c.setTool("rectangle");
  c.pointer(30, 30, true);
  c.key("ArrowRight");
  c.setTyped("20,10");
  c.submit();
  expect(c.status().axis).toBe("Free");
  c.key("ArrowUp");
  c.setTool("tape");
  expect(c.status().axis).toBe("Free");
});

it("face inference cannot move a pinned line or tape endpoint off its axis", () => {
  for (const tool of ["line", "tape"] as const) {
    const { store, controller: c, hit, view } = setup();
    const p = [V(), V(100), V(100, 100), V(0, 100)];
    store.execute({
      type: "draw",
      segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
    });
    const id = faces(store.getState())[0].id;
    let preview: [ReturnType<typeof V>, ReturnType<typeof V>][] = [];
    view.preview = (lines) => {
      preview = lines;
    };
    c.setTool(tool);
    hit({ id, kind: "face", point: V(10, 10) });
    if (tool === "tape") {
      c.press(10, 10);
      c.release(10, 10);
    } else c.pointer(10, 10, true);
    c.key("ArrowRight");
    hit({ id, kind: "face", point: V(20, 20) });
    c.pointer(20, 20);
    expect(preview[0][1]).toEqual(V(20, 10));
    expect(c.status().axis).toBe("X");
  }
});

it("tape shares automatic axis inference over empty space and Alt bypasses it", () => {
  for (const bypass of [false, true]) {
    const { store, controller: c, hit } = setup();
    c.setTool("tape");
    hit({ id: "world:origin", kind: "vertex", point: V() });
    c.press(0, 0);
    c.release(0, 0);
    hit(null);
    if (bypass) c.setSnapping(false);
    c.pointer(30, 1);
    c.press(30, 1);
    c.release(30, 1);
    expect(
      Object.values(store.getState().entities).find((e) => e.kind === "guide"),
    ).toMatchObject({ origin: V(30, bypass ? 1 : 0) });
  }
});
