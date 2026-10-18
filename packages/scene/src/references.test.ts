import { expect, it } from "vitest";
import { V } from "@gabarito/geometry";
import { createModel, addEdge, weld } from "@gabarito/core";
import { clipReference, referenceIntersections } from "./references";
it("clips both directions of an infinite ruler to a frustum and rejects outside or parallel lines", () => {
  const planes = [
    { normal: V(1), constant: 10 },
    { normal: V(-1), constant: 10 },
    { normal: V(0, 1), constant: 10 },
    { normal: V(0, -1), constant: 10 },
    { normal: V(0, 0, 1), constant: 10 },
    { normal: V(0, 0, -1), constant: 10 },
  ];
  expect(
    clipReference({ id: "g", origin: V(10000), direction: V(2) }, planes),
  ).toEqual([V(-10), V(10)]);
  expect(
    clipReference({ id: "g", origin: V(0, 11), direction: V(1) }, planes),
  ).toBeNull();
});
it("finds guide-edge crossings but never intersections of skew lines or edge extensions", () => {
  const m = createModel();
  m.entities.g = { id: "g", kind: "guide", origin: V(20, 10), direction: V(1) };
  addEdge(m, weld(m, V(40, 5)), weld(m, V(40, 15)));
  addEdge(m, weld(m, V(50, 5, 1)), weld(m, V(50, 15, 1)));
  addEdge(m, weld(m, V(60, 11)), weld(m, V(60, 15)));
  const points = referenceIntersections(m);
  expect(points).toContainEqual(V(40, 10));
  expect(points).not.toContainEqual(V(50, 10));
  expect(points).not.toContainEqual(V(60, 10));
});
