import { beforeAll, expect, it } from "vitest";
import { V, initializeGeometry, unit, sub, near } from "@gabarito/geometry";
import { createStore, vertices, faces } from "@gabarito/core";
import { createController } from "./controller";
import type { ToolHit, ToolView } from "./types";
beforeAll(initializeGeometry);
function setup(kind: ToolHit["kind"]) {
  const store = createStore();
  store.execute({ type: "draw", segments: [[V(10, 20), V(20, 20)]] });
  const source = vertices(store.getState())[0];
  let hit: ToolHit | null = {
      id: source.id,
      kind: "vertex",
      point: source.position,
    },
    feedback: ToolHit | null = null;
  let lines: Parameters<ToolView["preview"]>[0] = [],
    hint = "";
  const eye = V(10, -500, 500);
  const view: ToolView = {
    ray: (x, y) => ({ origin: eye, direction: unit(sub(V(x, 20, y), eye)) }),
    project: (p) => ({ x: p.x, y: p.z, visible: true }),
    visible: () => true,
    pick: () => hit,
    preview: (p) => {
      lines = p;
    },
    feedback: (p) => {
      feedback = p;
    },
    cursorHint: (text) => {
      hint = text;
    },
  };
  const target: ToolHit = { id: "target", kind, point: V(100, 200, 40) };
  if (kind === "face") {
    const p = [
      V(80, 180, 40),
      V(120, 180, 40),
      V(120, 220, 40),
      V(80, 220, 40),
    ];
    store.execute({
      type: "draw",
      segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
    });
    target.id = faces(store.getState())[0].id;
  }
  store.select([source.id]);
  const c = createController(store, view);
  c.setTool("move");
  c.pointer(10, 0, true);
  return {
    store,
    c,
    source,
    target,
    aim: () => {
      hit = target;
    },
    feedback: () => feedback,
    lines: () => lines,
    hint: () => hint,
  };
}
for (const kind of ["vertex", "edge", "face", "guide"] as const) {
  it(`pinned Move snaps to a ${kind} reference without changing other coordinates`, () => {
    const { store, c, source, target, aim, feedback, lines, hint } =
      setup(kind);
    const before = structuredClone(store.getState().entities);
    c.key("ArrowUp");
    aim();
    c.pointer(10, 28);
    expect(feedback()?.id).toBe(target.id);
    expect(hint()).toMatch(/level/);
    expect(
      lines().some(
        (l) => near(l[0], target.point) && near(l[1], V(10, 20, 40)),
      ),
    ).toBe(true);
    expect(store.getState().entities).toEqual(before);
    c.pointer(10, 28, true);
    expect(store.getState().entities[source.id]).toMatchObject({
      position: V(10, 20, 40),
    });
    const after = structuredClone(store.getState().entities);
    store.undo();
    expect(store.getState().entities).toEqual(before);
    store.redo();
    expect(store.getState().entities).toEqual(after);
  });
}
it("pinned Move keeps Alt bypass and typed dimensions above reference inference", () => {
  for (const mode of ["alt", "typed"] as const) {
    const { store, c, source, aim } = setup("vertex");
    c.key("ArrowUp");
    aim();
    if (mode === "alt") c.setSnapping(false);
    c.pointer(10, 28);
    if (mode === "typed") {
      c.setTyped("17");
      c.submit();
    } else c.pointer(10, 28, true);
    const v = store.getState().entities[source.id];
    expect(v.kind === "vertex" && v.position.z).toBeCloseTo(
      mode === "alt" ? 28 : 17,
    );
  }
});
