import { beforeAll, expect, it } from "vitest";
import {
  V,
  add,
  sub,
  mul,
  dot,
  cross,
  unit,
  rotate,
  near,
  initializeGeometry,
} from "@gabarito/geometry";
import type { Vec3, Segment } from "@gabarito/geometry";
import { createStore, faces, edges, facePlane, position } from "@gabarito/core";
import { createController } from "./controller";
import type { ToolHit, ToolView } from "./types";

beforeAll(initializeGeometry);
function setup(origin: Vec3, u: Vec3, v: Vec3) {
  const store = createStore(),
    n = unit(cross(u, v));
  const point = (x: number, y: number) =>
    add(origin, add(mul(u, x), mul(v, y)));
  const ps = [point(0, 0), point(100, 0), point(100, 100), point(0, 100)];
  store.execute({
    type: "draw",
    segments: ps.map((p, i) => [p, ps[(i + 1) % 4]]),
  });
  const face = faces(store.getState())[0];
  store.select([face.id]);
  let hit: ToolHit | null = null,
    preview: Segment[] = [],
    hint = "",
    feedback: ToolHit | null = null;
  let rayOffset = V();
  const view: ToolView = {
    ray: (x, y) => ({
      origin: add(add(point(x, y), mul(n, 1000)), rayOffset),
      direction: mul(n, -1),
    }),
    project: (p) => ({
      x: dot(sub(p, origin), u),
      y: dot(sub(p, origin), v),
      visible: true,
    }),
    visible: () => true,
    pick: () => hit,
    preview: (lines) => {
      preview = lines;
    },
    feedback: (h) => {
      feedback = h;
    },
    cursorHint: (text) => {
      hint = text;
    },
  };
  const c = createController(store, view);
  c.setTool("rotate");
  return {
    store,
    c,
    point,
    face,
    view,
    aim(x: number, y: number, kind: "face" | "edge" | "vertex" = "face") {
      const p = point(x, y),
        m = store.getState();
      const id =
        kind === "face"
          ? face.id
          : kind === "vertex"
            ? face.outer.find((id) => near(position(m, id), p))!
            : edges(m).find((e) =>
                e.vertices.every(
                  (id) =>
                    Math.abs(dot(sub(position(m, id), point(100, 0)), u)) <
                    1e-6,
                ),
              )!.id;
      hit = { kind, id, point: p };
    },
    noHit: () => {
      hit = null;
    },
    offset: (p: Vec3) => {
      rayOffset = p;
    },
    preview: () => preview,
    hint: () => hint,
    feedback: () => feedback,
  };
}
for (const [name, origin, u, v] of [
  ["raised horizontal", V(0, 0, 80), V(1, 0, 0), V(0, 1, 0)],
  ["vertical", V(100, 0, 0), V(0, 1, 0), V(0, 0, 1)],
  ["tilted", V(20, 30, 40), unit(V(1, 1, 0)), unit(V(-1, 1, 2))],
] as const) {
  for (const sign of [1, -1]) {
    it(`rotates on a ${name} face about A with B as zero (${sign > 0 ? "positive" : "negative"})`, () => {
      const { store, c, point, face, aim, preview, hint } = setup(origin, u, v);
      const before = structuredClone(store.getState().entities),
        a = point(50, 50);
      aim(50, 50);
      c.pointer(50, 50, true);
      aim(100, 50, "edge");
      c.pointer(100, 50);
      expect(c.status().measurement).toBe("0.0°");
      for (const id of face.outer)
        expect(
          preview().some((l) => near(l[0], position(store.getState(), id))),
        ).toBe(true);
      c.pointer(100, 50, true);
      expect(hint()).toContain("0.0°");
      aim(50, 50 + sign * 50);
      c.pointer(50, 50 + sign * 50);
      expect(c.status().measurement).toBe(`${sign * 90}.0°`);
      expect(store.getState().entities).toEqual(before);
      const n = facePlane(store.getState(), face).normal;
      for (const id of face.outer) {
        const expected = rotate(
          position(store.getState(), id),
          a,
          n,
          (sign * Math.PI) / 2,
        );
        expect(preview().some((l) => near(l[0], expected))).toBe(true);
      }
      c.pointer(50, 50 + sign * 50, true);
      for (const id of face.outer)
        expect(
          near(
            position(store.getState(), id),
            rotate(
              (before[id] as { position: Vec3 }).position,
              a,
              n,
              (sign * Math.PI) / 2,
            ),
          ),
        ).toBe(true);
      const after = structuredClone(store.getState().entities);
      expect(c.status().active).toBe(false);
      store.undo();
      expect(store.getState().entities).toEqual(before);
      store.redo();
      expect(store.getState().entities).toEqual(after);
    });
  }
}
it("infers a vertical plane from boundary A and B without moving A, and keeps exact snapped B", () => {
  const { store, c, aim, point, offset, hint, preview, feedback, noHit } =
    setup(V(100, 0, 0), V(0, 1, 0), V(0, 0, 1));
  const before = structuredClone(store.getState().entities);
  aim(0, 0, "vertex");
  c.pointer(0, 0, true);
  aim(100, 50, "edge");
  offset(V(0, 0, 0.3));
  c.pointer(100, 50, true);
  expect(c.status().measurement).toBe("0.0°");
  expect(feedback()?.kind).toBe("edge");
  expect(
    preview().some(
      (l) => near(l[0], point(0, 0)) && near(l[1], point(100, 50)),
    ),
  ).toBe(true);
  offset(V());
  noHit();
  c.pointer(-50, 100);
  expect(hint()).toContain("90.0°");
  c.key("Escape");
  expect(store.getState().entities).toEqual(before);
  expect(preview()).toEqual([]);
});
it("does not accept A again as the reference or rotate before a valid B", () => {
  const { store, c, aim } = setup(V(), V(1, 0, 0), V(0, 1, 0));
  const before = structuredClone(store.getState().entities);
  aim(50, 50);
  c.pointer(50, 50, true);
  c.pointer(50, 50, true);
  aim(100, 50, "edge");
  c.pointer(100, 50, true);
  expect(c.status().measurement).toBe("0.0°");
  expect(store.getState().entities).toEqual(before);
  expect(c.status().active).toBe(true);
});
it("freezes its plane at B even over another face and bypasses feature snapping with Alt", () => {
  const { store, c, aim, point, view, feedback } = setup(
    V(0, 0, 80),
    V(1, 0, 0),
    V(0, 1, 0),
  );
  aim(50, 50);
  c.pointer(50, 50, true);
  aim(100, 50, "edge");
  c.pointer(100, 50, true);
  store.execute({
    type: "draw",
    segments: [
      [V(50, 0, 0), V(50, 100, 0)],
      [V(50, 100, 0), V(50, 100, 100)],
      [V(50, 100, 100), V(50, 0, 100)],
      [V(50, 0, 100), V(50, 0, 0)],
    ],
  });
  const other = faces(store.getState()).find(
    (f) => f.id !== faces(store.getState())[0].id,
  )!;
  view.pick = () => ({ kind: "face", id: other.id, point: V(50, 100, 30) });
  c.pointer(50, 120);
  expect(c.status().measurement).toBe("90.0°");
  expect(feedback()).toBeNull();
  view.pick = () => ({
    kind: "vertex",
    id: "reference",
    point: point(50, 100),
  });
  c.pointer(60, 100);
  expect(c.status().measurement).toBe("90.0°");
  c.setSnapping(false);
  expect(parseFloat(c.status().measurement)).toBeCloseTo(78.7, 1);
});
it("keeps explicit axis overrides, reprojects B and requests a new B when it collapses", () => {
  const { store, c, aim, point, view, hint } = setup(
    V(0, 0, 80),
    V(1, 0, 0),
    V(0, 1, 0),
  );
  const before = structuredClone(store.getState().entities);
  aim(50, 50);
  c.pointer(50, 50, true);
  aim(100, 50, "edge");
  c.pointer(100, 50, true);
  c.key("ArrowRight");
  expect(c.status().axis).toBe("X");
  expect(hint()).not.toMatch(/alignment|diagonal|intersection/);
  expect(c.status().measurement).toBe("0.0°");
  view.pick = () => ({ id: "b", kind: "vertex", point: point(50, 100) });
  c.pointer(50, 100, true);
  expect(c.status().active).toBe(true);
  expect(hint()).toContain("0.0°");
  c.setTyped("-90");
  c.submit();
  for (const f of faces({ ...store.getState(), entities: before }))
    for (const id of f.outer)
      expect(
        near(
          position(store.getState(), id),
          rotate(
            (before[id] as { position: Vec3 }).position,
            point(50, 50),
            V(1, 0, 0),
            -Math.PI / 2,
          ),
        ),
      ).toBe(true);
  expect(c.status().axis).toBe("Free");
});
it("does not commit a stale angle when the pointer ray is parallel to the frozen plane", () => {
  const { store, c, aim, view } = setup(V(), V(1, 0, 0), V(0, 1, 0));
  const before = structuredClone(store.getState().entities);
  aim(50, 50);
  c.pointer(50, 50, true);
  aim(100, 50, "edge");
  c.pointer(100, 50, true);
  aim(50, 100);
  c.pointer(50, 100);
  view.pick = () => null;
  view.ray = () => ({ origin: V(0, 0, 100), direction: V(1, 0, 0) });
  c.pointer(70, 70, true);
  expect(store.getState().entities).toEqual(before);
  expect(c.status().active).toBe(true);
});
it("cancels the reference and frozen plane on tool change before starting another rotation", () => {
  const { store, c, aim, preview } = setup(V(), V(1, 0, 0), V(0, 1, 0));
  const before = structuredClone(store.getState().entities);
  aim(50, 50);
  c.pointer(50, 50, true);
  aim(100, 50, "edge");
  c.pointer(100, 50, true);
  aim(50, 100);
  c.pointer(50, 100);
  c.setTool("select");
  expect(store.getState().entities).toEqual(before);
  expect(preview()).toEqual([]);
  c.setTool("rotate");
  aim(50, 50);
  c.pointer(50, 50, true);
  aim(50, 100);
  c.pointer(50, 100, true);
  expect(c.status().measurement).toBe("0.0°");
});
it("keeps the clicked face point as A when an axis is pinned before the first click", () => {
  const { store, c, aim, point, hint } = setup(
    V(0, 0, 80),
    V(1, 0, 0),
    V(0, 1, 0),
  );
  const before = structuredClone(store.getState().entities);
  c.key("ArrowRight");
  aim(49, 49);
  c.pointer(49, 49, true);
  expect(hint()).toContain("Reference intersection");
  expect(c.status().active).toBe(true);
  c.setTyped("90");
  c.submit();
  for (const e of Object.values(before)) {
    if (e.kind !== "vertex") continue;
    expect(
      near(
        position(store.getState(), e.id),
        rotate(e.position, point(50, 50), V(1, 0, 0), Math.PI / 2),
      ),
    ).toBe(true);
  }
});
for (const [name, origin, u, v] of [
  ["horizontal", V(0, 0, 80), V(1, 0, 0), V(0, 1, 0)],
  ["vertical", V(100, 0, 0), V(0, 1, 0), V(0, 0, 1)],
] as const) {
  it(`shows face center, midpoint and diagonal hints through a ${name} rotation with exact snapping and Alt bypass`, () => {
    const { store, c, aim, point, feedback, hint, preview, face } = setup(
      origin,
      u,
      v,
    );
    const before = structuredClone(store.getState().entities);
    aim(49, 49);
    c.pointer(49, 49);
    expect(hint()).toBe("Reference intersection");
    expect(near(feedback()!.point, point(50, 50))).toBe(true);
    expect(preview().length).toBeGreaterThan(0);
    c.pointer(49, 49, true);
    aim(85, 49);
    c.pointer(85, 49);
    expect(hint()).toContain("Midpoint alignment");
    expect(near(feedback()!.point, point(85, 50))).toBe(true);
    c.pointer(85, 49, true);
    aim(60, 61);
    c.pointer(60, 61);
    expect(hint()).toContain("Face diagonal");
    expect(c.status().measurement).toBe("45.0°");
    expect(near(feedback()!.point, point(60.5, 60.5))).toBe(true);
    expect(store.getState().entities).toEqual(before);
    c.setSnapping(false);
    expect(hint()).not.toMatch(/diagonal|alignment|intersection/);
    expect(c.status().measurement).toBe("47.7°");
    c.setSnapping(true);
    c.pointer(60, 61, true);
    const n = facePlane({ ...store.getState(), entities: before }, face).normal;
    for (const id of face.outer)
      expect(
        near(
          position(store.getState(), id),
          rotate(
            (before[id] as { position: Vec3 }).position,
            point(50, 50),
            n,
            Math.PI / 4,
          ),
        ),
      ).toBe(true);
    store.undo();
    expect(store.getState().entities).toEqual(before);
  });
}
