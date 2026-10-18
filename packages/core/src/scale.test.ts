import { beforeAll, expect, it } from "vitest";
import { V, initializeGeometry } from "@gabarito/geometry";
import { createStore, faces, vertices, edges, guides } from "./index";
beforeAll(initializeGeometry);
function setup() {
  const s = createStore(),
    p = [V(), V(100, 0), V(100, 50), V(0, 50)];
  s.execute({ type: "draw", segments: p.map((a, i) => [a, p[(i + 1) % 4]]) });
  return s;
}
it("scales shared selection once about a fixed anchor, with exact history", () => {
  const s = setup(),
    m = s.getState(),
    ids = [
      faces(m)[0].id,
      ...edges(m).map((e) => e.id),
      ...vertices(m).map((v) => v.id),
    ],
    before = structuredClone(m.entities);
  s.execute({ type: "scale", ids, anchor: V(), factors: V(2, 3, 1) });
  expect(vertices(s.getState()).map((v) => v.position)).toEqual([
    V(),
    V(200, 0),
    V(200, 150),
    V(0, 150),
  ]);
  const after = structuredClone(s.getState().entities);
  expect(Object.keys(after)).toEqual(Object.keys(before));
  s.undo();
  expect(s.getState().entities).toEqual(before);
  s.redo();
  expect(s.getState().entities).toEqual(after);
});
it("scales selected rulers consistently and leaves unselected geometry unchanged", () => {
  const s = setup();
  s.execute({ type: "guide", origin: V(10, 20, 30), direction: V(1, 1, 0) });
  const before = structuredClone(vertices(s.getState())),
    g = guides(s.getState())[0];
  s.execute({
    type: "scale",
    ids: [g.id, g.id],
    anchor: V(),
    factors: V(2, 3, 1),
  });
  expect(vertices(s.getState())).toEqual(before);
  const result = guides(s.getState())[0];
  expect(result.origin).toEqual(V(20, 60, 30));
  expect(result.direction.y / result.direction.x).toBeCloseTo(1.5);
});
for (const factors of [
  V(0, 1, 1),
  V(-1, 1, 1),
  V(NaN, 1, 1),
  V(1, Infinity, 1),
])
  it(`rejects invalid scale factors ${JSON.stringify(factors)} atomically`, () => {
    const s = setup(),
      before = structuredClone(s.getState());
    expect(() =>
      s.execute({
        type: "scale",
        ids: [faces(before)[0].id],
        anchor: V(),
        factors,
      }),
    ).toThrow(/positive/);
    expect(s.getState()).toEqual(before);
  });
it("rolls back a scale that would make a connected face nonplanar", () => {
  const s = setup();
  s.execute({
    type: "pushpull",
    face: faces(s.getState())[0].id,
    distance: 50,
  });
  const before = structuredClone(s.getState()),
    v = vertices(before).find(
      (v) => v.position.x === 100 && v.position.z === 50,
    )!;
  expect(() =>
    s.execute({ type: "scale", ids: [v.id], anchor: V(), factors: V(2, 1, 1) }),
  ).toThrow();
  expect(s.getState()).toEqual(before);
});
it("accepts small positive factors when the resulting geometry remains valid", () => {
  const s = setup();
  s.execute({
    type: "scale",
    ids: [faces(s.getState())[0].id],
    anchor: V(),
    factors: V(0.000001, 1, 1),
  });
  expect(
    Math.max(...vertices(s.getState()).map((v) => v.position.x)),
  ).toBeCloseTo(0.0001, 8);
});
it("rejects a nonfinite scale anchor without publishing a transaction", () => {
  const s = setup(),
    before = structuredClone(s.getState());
  expect(() =>
    s.execute({
      type: "scale",
      ids: before.selection,
      anchor: V(Infinity, 0, 0),
      factors: V(2, 2, 2),
    }),
  ).toThrow();
  expect(s.getState()).toEqual(before);
});
