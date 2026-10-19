import { beforeAll, expect, it } from "vitest";
import {
  V,
  initializeGeometry,
  insetContours,
  plane,
  project,
  area2,
  rotate,
  sub,
  length,
  near,
} from "@gabarito/geometry";
import { createStore, faces, surface, vertices } from "./index";
beforeAll(initializeGeometry);
const rectangle = (x: number, y: number, w: number, h: number) => [
  V(x, y),
  V(x + w, y),
  V(x + w, y + h),
  V(x, y + h),
];
function draw(points: ReturnType<typeof V>[]) {
  const s = createStore();
  s.execute({
    type: "draw",
    segments: points.map((p, i) => [p, points[(i + 1) % points.length]]),
  });
  return s;
}
it("insets a rectangle by perpendicular distance, partitions its surface and has exact history", () => {
  const s = draw(rectangle(0, 0, 100, 80)),
    before = structuredClone(s.getState().entities),
    face = faces(s.getState())[0];
  s.execute({ type: "offset", face: face.id, distance: 10 });
  expect(faces(s.getState())).toHaveLength(2);
  const inner = faces(s.getState()).find((f) => f.holes.length === 0)!,
    ps = surface(s.getState(), inner).outer;
  expect(Math.min(...ps.map((p) => p.x))).toBeCloseTo(10);
  expect(Math.max(...ps.map((p) => p.x))).toBeCloseTo(90);
  expect(Math.min(...ps.map((p) => p.y))).toBeCloseTo(10);
  expect(Math.max(...ps.map((p) => p.y))).toBeCloseTo(70);
  const after = structuredClone(s.getState().entities);
  s.undo();
  expect(s.getState().entities).toEqual(before);
  s.redo();
  expect(s.getState().entities).toEqual(after);
  s.execute({ type: "pushpull", face: inner.id, distance: 20 });
  expect(
    vertices(s.getState()).some((v) => Math.abs(v.position.z - 20) < 1e-5),
  ).toBe(true);
});
it("handles winding and tilted face planes without scaling the polygon", () => {
  const ps = rectangle(0, 0, 100, 80).map((p) =>
      rotate(p, V(), V(1, 2, 3), 0.7),
    ),
    loops = insetContours({ outer: [...ps].reverse(), holes: [] }, 10),
    expected = rectangle(10, 10, 80, 60).map((p) =>
      rotate(p, V(), V(1, 2, 3), 0.7),
    );
  expect(loops).toHaveLength(1);
  for (const p of expected)
    expect(loops[0].some((q) => length(sub(p, q)) < 1e-4)).toBe(true);
});
it("uses miter offsets for triangles and preserves exact perpendicular edge distances", () => {
  const points = [V(), V(100, 0), V(50, 80)],
    loops = insetContours({ outer: points, holes: [] }, 5);
  expect(loops[0]).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    const a = points[i],
      b = points[(i + 1) % 3],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const distances = loops[0].map(
      (p) => Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / Math.hypot(dx, dy),
    );
    expect(distances.sort((a, b) => a - b)[0]).toBeCloseTo(5, 4);
    expect(distances.sort((a, b) => a - b)[1]).toBeCloseTo(5, 4);
  }
});
it("erodes concave necks into multiple loops", () => {
  const points = [
    V(0, 0),
    V(40, 0),
    V(40, 15),
    V(60, 15),
    V(60, 0),
    V(100, 0),
    V(100, 40),
    V(60, 40),
    V(60, 25),
    V(40, 25),
    V(40, 40),
    V(0, 40),
  ];
  expect(insetContours({ outer: points, holes: [] }, 6)).toHaveLength(2);
});
it("expands existing holes into the material while preserving all contours", () => {
  const loops = insetContours(
      { outer: rectangle(0, 0, 100, 100), holes: [rectangle(40, 40, 20, 20)] },
      5,
    ),
    frame = plane(V(), V(0, 0, 1));
  expect(loops).toHaveLength(2);
  const areas = loops
    .map((l) => Math.abs(area2(l.map((p) => project(p, frame)))))
    .sort((a, b) => a - b);
  expect(areas[0]).toBeCloseTo(900);
  expect(areas[1]).toBeCloseTo(8100);
});
for (const distance of [0, -1, NaN, Infinity, 50])
  it(`refuses invalid/collapsed offsets ${distance} atomically`, () => {
    const s = draw(rectangle(0, 0, 100, 80)),
      before = structuredClone(s.getState());
    expect(() =>
      s.execute({ type: "offset", face: faces(before)[0].id, distance }),
    ).toThrow();
    expect(s.getState()).toEqual(before);
  });
it("allows repeated offsets on the inner partition", () => {
  const s = draw(rectangle(0, 0, 100, 80));
  s.execute({ type: "offset", face: faces(s.getState())[0].id, distance: 10 });
  const inner = faces(s.getState()).find((f) => !f.holes.length)!;
  s.execute({ type: "offset", face: inner.id, distance: 5 });
  expect(faces(s.getState())).toHaveLength(3);
  expect(vertices(s.getState()).some((v) => near(v.position, V(15, 15)))).toBe(
    true,
  );
});
it("preserves a deleted hole while partitioning the border around both face boundaries", () => {
  const s = draw(rectangle(0, 0, 100, 100)),
    hole = rectangle(40, 40, 20, 20);
  s.execute({
    type: "draw",
    segments: hole.map((p, i) => [p, hole[(i + 1) % 4]]),
  });
  const inner = faces(s.getState()).find((f) => !f.holes.length)!;
  s.execute({ type: "delete", ids: [inner.id] });
  s.execute({ type: "offset", face: faces(s.getState())[0].id, distance: 5 });
  expect(faces(s.getState())).toHaveLength(3);
  expect(vertices(s.getState()).some((v) => near(v.position, V(35, 35)))).toBe(
    true,
  );
  expect(
    faces(s.getState()).some((f) =>
      surface(s.getState(), f).outer.every(
        (p) => p.x >= 40 && p.x <= 60 && p.y >= 40 && p.y <= 60,
      ),
    ),
  ).toBe(false);
});
it("offsets a circle polygon by edge distance rather than its bounding box", async () => {
  const { circlePoints } = await import("@gabarito/geometry");
  const ps = circlePoints(V(), plane(V(), V(0, 0, 1)), 30),
    contours = insetContours({ outer: ps, holes: [] }, 5);
  expect(contours[0]).toHaveLength(24);
  const expectedRadius = 30 - 5 / Math.cos(Math.PI / 24);
  for (const p of contours[0]) expect(length(p)).toBeCloseTo(expectedRadius, 4);
});
