import { beforeAll, expect, it } from "vitest";
import { V, initializeGeometry } from "@gabarito/geometry";
import {
  createStore,
  guides,
  faces,
  edges,
  vertices,
  referenceLines,
  WORLD_AXES,
} from "./index";
beforeAll(initializeGeometry);
it("creates one non-geometric ruler with exact undo/redo and no caller-owned coordinates", () => {
  const s = createStore(),
    origin = V(10, 20, 30);
  s.execute({ type: "guide", origin, direction: V(1, 2, 3) });
  const after = structuredClone(s.getState().entities);
  origin.x = 500;
  expect(guides(s.getState())[0].origin.x).toBe(10);
  expect([
    faces(s.getState()).length,
    edges(s.getState()).length,
    vertices(s.getState()).length,
  ]).toEqual([0, 0, 0]);
  s.undo();
  expect(guides(s.getState())).toHaveLength(0);
  s.redo();
  expect(s.getState().entities).toEqual(after);
});
it("rejects invalid rulers atomically", () => {
  const s = createStore();
  for (const [origin, direction] of [
    [V(), V()],
    [V(NaN), V(1)],
    [V(), V(Infinity)],
  ])
    expect(() => s.execute({ type: "guide", origin, direction })).toThrow(
      /finite/,
    );
  expect(guides(s.getState())).toHaveLength(0);
  expect(s.canUndo()).toBe(false);
});
it("moves, rotates and deletes user rulers without touching world references", () => {
  const s = createStore();
  s.execute({ type: "guide", origin: V(10), direction: V(1) });
  const id = guides(s.getState())[0].id;
  s.execute({ type: "move", ids: [id], delta: V(0, 20) });
  expect(guides(s.getState())[0].origin).toEqual(V(10, 20));
  s.execute({
    type: "rotate",
    ids: [id],
    center: V(),
    axis: V(0, 0, 1),
    angle: Math.PI / 2,
  });
  expect(guides(s.getState())[0].origin.x).toBeCloseTo(-20);
  expect(guides(s.getState())[0].direction.y).toBeCloseTo(1);
  s.execute({
    type: "delete",
    ids: [id, ...WORLD_AXES.map((a) => a.id), "world:origin"],
  });
  expect(referenceLines(s.getState())).toEqual(WORLD_AXES);
  s.undo();
  expect(guides(s.getState())).toHaveLength(1);
});

it("drawing and solid push/pull leave ruler entities untouched", () => {
  const s = createStore();
  s.execute({ type: "guide", origin: V(25, 25), direction: V(1) });
  const guide = structuredClone(guides(s.getState())[0]);
  const p = [V(), V(50), V(50, 50), V(0, 50)];
  s.execute({ type: "draw", segments: p.map((a, i) => [a, p[(i + 1) % 4]]) });
  s.execute({
    type: "pushpull",
    face: faces(s.getState())[0].id,
    distance: 20,
  });
  expect(guides(s.getState())).toEqual([guide]);
  expect(faces(s.getState())).toHaveLength(6);
  expect(edges(s.getState())).toHaveLength(12);
});
