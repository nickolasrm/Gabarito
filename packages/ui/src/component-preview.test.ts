import { beforeAll, expect, it } from "vitest";
import { V, initializeGeometry } from "@gabarito/geometry";
import { createStore, faces } from "@gabarito/core";
import { componentPreview } from "./component-preview";
beforeAll(initializeGeometry);
it("previews nested definitions, holes and loose geometry within thumbnail bounds", () => {
  const s = createStore();
  const draw = (p: ReturnType<typeof V>[]) =>
    s.execute({
      type: "draw",
      segments: p.map((a, i) => [a, p[(i + 1) % p.length]]),
    });
  draw([V(), V(100), V(100, 100), V(0, 100)]);
  draw([V(20, 20), V(40, 20), V(40, 40), V(20, 40)]);
  const inner = faces(s.getState()).find((f) => !f.holes.length)!;
  s.execute({ type: "delete", ids: [inner.id] });
  s.execute({ type: "draw", segments: [[V(120), V(150, 20, 30)]] });
  s.execute({
    type: "make-component",
    ids: Object.keys(s.getState().entities),
    name: "Child",
  });
  const child = Object.keys(s.getState().definitions)[0];
  s.execute({
    type: "make-component",
    ids: s.getState().selection,
    name: "Parent",
  });
  const parent = Object.keys(s.getState().definitions).find(
    (id) => id !== child,
  )!;
  const a = componentPreview(s.getState().definitions, child),
    b = componentPreview(s.getState().definitions, parent);
  expect(b).toEqual(a);
  expect(a.faces).toHaveLength(1);
  expect(a.faces[0].match(/M/g)).toHaveLength(2);
  expect(a.lines).toMatch(/^M/);
  const numbers = [...a.faces, a.lines]
    .join("")
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number);
  expect(numbers.every((n) => Number.isFinite(n) && n >= 6 && n <= 66)).toBe(
    true,
  );
});
it("updates after definition edits and handles missing, empty and point definitions without invalid coordinates", () => {
  const s = createStore();
  s.execute({ type: "draw", segments: [[V(), V(100)]] });
  s.execute({
    type: "make-component",
    ids: Object.keys(s.getState().entities),
    name: "Line",
  });
  const definition = Object.keys(s.getState().definitions)[0],
    id = s.getState().selection[0],
    before = componentPreview(s.getState().definitions, definition);
  s.enterComponent(id);
  const point = Object.values(s.getState().entities).find(
    (e) => e.kind === "vertex",
  )!;
  s.execute({ type: "move", ids: [point.id], delta: V(0, 0, 50) });
  expect(componentPreview(s.getState().definitions, definition)).not.toEqual(
    before,
  );
  s.execute({ type: "delete", ids: Object.keys(s.getState().entities) });
  expect(componentPreview(s.getState().definitions, definition)).toEqual({
    faces: [],
    lines: "",
    points: [],
  });
  expect(componentPreview(s.getState().definitions, "missing")).toEqual({
    faces: [],
    lines: "",
    points: [],
  });
  s.execute({ type: "draw", segments: [[V(10, 20), V(20, 20)]] });
  const vertex = Object.values(s.getState().entities).find(
    (e) => e.kind === "vertex",
  )!;
  s.execute({ type: "make-component", ids: [vertex.id], name: "Point" });
  const pointDefinition = Object.values(s.getState().definitions).find(
    (d) => d.name === "Point",
  )!;
  expect(
    componentPreview(s.getState().definitions, pointDefinition.id).points,
  ).toEqual([{ x: 36, y: 36 }]);
});

it("paints the three near cube faces after its rear faces in the isometric view", () => {
  const s = createStore(),
    p = [V(), V(100), V(100, 100), V(0, 100)];
  s.execute({ type: "draw", segments: p.map((a, i) => [a, p[(i + 1) % 4]]) });
  s.execute({
    type: "pushpull",
    face: faces(s.getState())[0].id,
    distance: 100,
  });
  s.execute({
    type: "make-component",
    ids: Object.keys(s.getState().entities),
    name: "Cube",
  });
  const preview = componentPreview(
    s.getState().definitions,
    Object.keys(s.getState().definitions)[0],
  );
  const corners = (path: string) =>
    path.split(/[MLZ]/).filter(Boolean).sort().join(";");
  const near = [
    "M6.00,51.00L36.00,66.00L36.00,36.00L6.00,21.00Z",
    "M36.00,66.00L66.00,51.00L66.00,21.00L36.00,36.00Z",
    "M6.00,21.00L36.00,6.00L66.00,21.00L36.00,36.00Z",
  ];
  expect(new Set(preview.faces.slice(-3).map(corners))).toEqual(
    new Set(near.map(corners)),
  );
});
