import { beforeAll, expect, it } from "vitest";
import {
  V,
  initializeGeometry,
  rotate,
  dot,
  sub,
  near,
} from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { createStore, faces, facePlane } from "@gabarito/core";
import { snapOnFace, midpointEdge } from "./face-snap";
import { snapAlongAxis } from "./axis-snap";
import { snapProportion, rectangleRatio } from "./proportions";
import type { ToolView } from "./types";
beforeAll(initializeGeometry);
function setup(transform = (p: Vec3) => p) {
  const store = createStore(),
    ps = [V(), V(100), V(100, 100), V(0, 100)].map(transform);
  store.execute({
    type: "draw",
    segments: ps.map((a, i) => [a, ps[(i + 1) % 4]]),
  });
  const frame = facePlane(store.getState(), faces(store.getState())[0]);
  const view: ToolView = {
    project: (p) => ({
      x: dot(sub(p, frame.origin), frame.u),
      y: dot(sub(p, frame.origin), frame.v),
      visible: true,
    }),
    visible: () => true,
    ray: () => ({ origin: V(0, 0, 1000), direction: V(0, 0, -1) }),
    pick: () => null,
    preview: () => {},
    feedback: () => {},
    cursorHint: () => {},
  };
  return { store, view, frame };
}
it("infers the owner's 40,49 endpoint, face diagonals and the midpoint crosshair center", () => {
  const { store, frame, view } = setup(),
    m = store.getState();
  expect(snapOnFace(m, frame, V(40, 49), view)?.point).toEqual(V(40, 50));
  const diagonal = snapOnFace(m, frame, V(25, 26), view);
  expect(diagonal?.hit.snap).toBe("diagonal");
  expect(near(diagonal!.point, V(25.5, 25.5))).toBe(true);
  expect(near(snapOnFace(m, frame, V(49, 51), view)!.point, V(50, 50))).toBe(
    true,
  );
});
it("infers midpoint alignments on a rotated face in its own plane", () => {
  const turn = (p: Vec3) => rotate(p, V(), V(1, 2, 3), 0.7),
    { store, frame, view } = setup(turn);
  expect(
    near(
      snapOnFace(store.getState(), frame, turn(V(40, 49)), view)!.point,
      turn(V(40, 50)),
    ),
  ).toBe(true);
});
it("does not infer across a hole or from hidden reference points", () => {
  const { store, view, frame } = setup();
  const p = [V(20, 20), V(80, 20), V(80, 80), V(20, 80)];
  store.execute({
    type: "draw",
    segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
  });
  store.execute({
    type: "delete",
    ids: [faces(store.getState()).find((f) => !f.holes.length)!.id],
  });
  expect(snapOnFace(store.getState(), frame, V(49, 50), view)).toBeNull();
  view.visible = () => false;
  expect(snapOnFace(store.getState(), frame, V(10, 49), view)).toBeNull();
});
it("recovers a midpoint's source edge and snaps integer proportions in every quadrant", () => {
  const { store, frame, view } = setup();
  expect(
    midpointEdge(store.getState(), {
      id: "virtual",
      kind: "vertex",
      point: V(50),
      snap: "midpoint",
    }),
  ).toBeDefined();
  for (const [x, y] of [
    [100, 98],
    [-100, 98],
    [100, -98],
    [-100, -98],
    [200, 98],
    [100, 298],
    [400, 98],
  ]) {
    const point = snapProportion(V(), V(x, y), frame, view)!;
    expect(point).not.toBeNull();
    expect(rectangleRatio(point.x, point.y)).not.toBe("");
  }
  expect(snapProportion(V(), V(100, 75), frame, view)).toBeNull();
});
it("push/pull matches visible vertex and edge levels while keeping its extrusion axis", () => {
  const { store, view } = setup();
  view.project = (p) => ({ x: p.x, y: p.z, visible: true });
  for (const kind of ["vertex", "edge"] as const) {
    const result = snapAlongAxis(
      store.getState(),
      V(10, 20),
      V(10, 20, 28),
      V(0, 0, 1),
      "active",
      { id: "target", kind, point: V(100, 100, 30) },
      view,
    );
    expect(result?.point).toEqual(V(10, 20, 30));
    expect(result?.lines[0][0]).toEqual(V(100, 100, 30));
  }
  view.visible = () => false;
  expect(
    snapAlongAxis(
      store.getState(),
      V(),
      V(),
      V(0, 0, 1),
      "active",
      { id: "hidden", kind: "vertex", point: V(0, 0, 30) },
      view,
    ),
  ).toBeNull();
});
it("push/pull aligns explicitly hovered face planes regardless of free depth, rejecting source and parallel planes", () => {
  const { store, view } = setup();
  view.project = (p) => ({ x: p.x, y: p.z, visible: true });
  const p = [V(200, 0, 25), V(300, 0, 25), V(300, 100, 25), V(200, 100, 25)];
  store.execute({
    type: "draw",
    segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
  });
  const id = faces(store.getState()).find(
    (f) => facePlane(store.getState(), f).origin.z === 25,
  )!.id;
  const hit = { id, kind: "face" as const, point: V(250, 50, 25) },
    m = store.getState();
  expect(
    snapAlongAxis(m, V(), V(0, 0, 24), V(0, 0, 1), "active", hit, view)?.point,
  ).toEqual(V(0, 0, 25));
  expect(
    snapAlongAxis(m, V(), V(0, 0, 5), V(0, 0, 1), "active", hit, view)?.point,
  ).toEqual(V(0, 0, 25));
  expect(
    snapAlongAxis(m, V(), V(0, 0, 24), V(0, 0, 1), id, hit, view),
  ).toBeNull();
  expect(snapAlongAxis(m, V(), V(24), V(1), "active", hit, view)).toBeNull();
});

it("a starting-plane edge cannot reset a free extrusion from far away, but can snap near zero", () => {
  const { store, view } = setup();
  view.project = (p) => ({ x: p.x, y: p.z, visible: true });
  const hit = { id: "edge", kind: "edge" as const, point: V(100, 100) };
  expect(
    snapAlongAxis(
      store.getState(),
      V(),
      V(0, 0, 40),
      V(0, 0, 1),
      "active",
      hit,
      view,
    ),
  ).toBeNull();
  expect(
    snapAlongAxis(
      store.getState(),
      V(),
      V(0, 0, 2),
      V(0, 0, 1),
      "active",
      hit,
      view,
    )?.point,
  ).toEqual(V());
});

it("axis references preserve unpinned coordinates in both signs of X, Y and Z", () => {
  const { store, view } = setup(),
    start = V(10, 20, 30),
    hit = { id: "target", kind: "vertex" as const, point: V(100, 200, 300) };
  for (const [axis, directions] of [
    ["x", [V(1), V(-1)]],
    ["y", [V(0, 1), V(0, -1)]],
    ["z", [V(0, 0, 1), V(0, 0, -1)]],
  ] as const)
    for (const d of directions) {
      const point = snapAlongAxis(
        store.getState(),
        start,
        start,
        d,
        "",
        hit,
        view,
      )!.point;
      expect(point).toEqual({ ...start, [axis]: hit.point[axis] });
    }
});
it("an explicitly hovered rotated plane intersects the pinned axis without moving other coordinates", () => {
  const { store, view } = setup();
  const angle = 0.3,
    p = [V(40, 0), V(40, 100), V(40, 100, 100), V(40, 0, 100)].map((p) =>
      rotate(p, V(), V(0, 0, 1), angle),
    );
  store.execute({
    type: "draw",
    segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
  });
  const id = faces(store.getState()).find(
    (f) => Math.abs(facePlane(store.getState(), f).normal.z) < 1e-5,
  )!.id;
  const point = snapAlongAxis(
    store.getState(),
    V(0, 20, 30),
    V(5, 20, 30),
    V(1),
    "",
    { id, kind: "face", point: rotate(V(40, 50, 50), V(), V(0, 0, 1), angle) },
    view,
  )!.point;
  expect(point.x).toBeCloseTo((40 - 20 * Math.sin(angle)) / Math.cos(angle));
  expect(point.y).toBe(20);
  expect(point.z).toBe(30);
});
it("hovering another starting-level face still requires proximity to zero", () => {
  const { store, view } = setup(),
    id = faces(store.getState())[0].id,
    hit = { id, kind: "face" as const, point: V(80, 80) };
  view.project = (p) => ({ x: p.x, y: p.z, visible: true });
  expect(
    snapAlongAxis(
      store.getState(),
      V(),
      V(0, 0, 40),
      V(0, 0, 1),
      "other",
      hit,
      view,
    ),
  ).toBeNull();
  expect(
    snapAlongAxis(
      store.getState(),
      V(),
      V(0, 0, 2),
      V(0, 0, 1),
      "other",
      hit,
      view,
    )?.point,
  ).toEqual(V());
});
