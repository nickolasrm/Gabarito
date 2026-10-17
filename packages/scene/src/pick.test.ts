import { describe, expect, it } from "vitest";
import { buildRectangle, createStore, facesOf, type DocumentState, type Store } from "@gabarito/core";
import { pick } from "./pick";

const ORIGIN = { x: 0, y: 0, z: 0 };
const DOWN = { x: 0, y: 0, z: -1 };

function square(store: Store, corner: { x: number; y: number; z: number }, size: number): void {
  store.dispatch({
    type: "addEntities",
    entities: buildRectangle(
      store.getState(),
      corner,
      { x: size, y: 0, z: 0 },
      { x: 0, y: size, z: 0 },
    ).entities,
  });
}

function rayFromAbove(point: { x: number; y: number; z: number }) {
  return { origin: { x: point.x, y: point.y, z: 5000 }, direction: DOWN };
}

function areaOf(doc: DocumentState, id: string): number {
  const face = doc.entities[id];
  if (!face || face.kind !== "face") return 0;
  const points = face.points.map((pointId) => doc.entities[pointId]).map((entity) => {
    if (entity.kind !== "point") throw new Error("not a point");
    return entity.position;
  });
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
}

describe("picking", () => {
  it("picks a single face", () => {
    const store = createStore();
    square(store, ORIGIN, 4000);
    const hit = pick(rayFromAbove({ x: 1000, y: 1000, z: 0 }), store.getState(), 50);
    expect(hit?.kind).toBe("face");
  });

  it("misses when the ray does not cross the face", () => {
    const store = createStore();
    square(store, ORIGIN, 4000);
    expect(pick(rayFromAbove({ x: 9000, y: 9000, z: 0 }), store.getState(), 50)).toBeNull();
  });

  it("picks the innermost of two stacked coplanar faces", () => {
    const store = createStore();
    square(store, ORIGIN, 4000);
    square(store, { x: 1500, y: 1500, z: 0 }, 1000);

    const doc = store.getState();
    const faces = facesOf(doc);
    expect(faces).toHaveLength(2);
    const smallest = faces.reduce((a, b) => (areaOf(doc, a.id) < areaOf(doc, b.id) ? a : b));

    // Dead centre of the inner square, which is also inside the outer one.
    const hit = pick(rayFromAbove({ x: 2000, y: 2000, z: 0 }), doc, 50);
    expect(hit?.entityId).toBe(smallest.id);
    expect(areaOf(doc, hit?.entityId ?? "")).toBe(1_000_000);
  });

  it("still picks the outer face outside the inner one", () => {
    const store = createStore();
    square(store, ORIGIN, 4000);
    square(store, { x: 1500, y: 1500, z: 0 }, 1000);

    const doc = store.getState();
    const faces = facesOf(doc);
    const largest = faces.reduce((a, b) => (areaOf(doc, a.id) > areaOf(doc, b.id) ? a : b));
    const hit = pick(rayFromAbove({ x: 300, y: 300, z: 0 }), doc, 50);
    expect(hit?.entityId).toBe(largest.id);
  });
});
