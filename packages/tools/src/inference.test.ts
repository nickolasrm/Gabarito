import { describe, expect, it } from "vitest";
import type { Vec3 } from "@gabarito/geometry";
import { buildGuide, buildRectangle, createStore, type DocumentState, type Store } from "@gabarito/core";
import { createAxisLock, projectOntoAxis } from "./axis-lock";
import { resolveSnap } from "./inference";

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const CORNER: Vec3 = { x: 0, y: 0, z: 0 };
const U: Vec3 = { x: 1000, y: 0, z: 0 };
const V: Vec3 = { x: 0, y: 1000, z: 0 };

function square(): Store {
  const store = createStore({ unit: "mm" });
  store.dispatch({
    type: "addEntities",
    entities: buildRectangle(store.getState(), CORNER, U, V).entities,
  });
  return store;
}

function snap(
  doc: DocumentState,
  free: Vec3,
  options: { tolerance?: number; anchor?: Vec3 | null; lock?: ReturnType<typeof createAxisLock> | null; snapping?: boolean } = {},
) {
  return resolveSnap({
    doc,
    free,
    tolerance: options.tolerance ?? 20,
    anchor: options.anchor ?? null,
    lock: options.lock ?? null,
    snapping: options.snapping ?? true,
  });
}

describe("inference", () => {
  it("snaps to a vertex above everything else", () => {
    const store = square();
    const result = snap(store.getState(), { x: 8, y: 6, z: 0 });
    expect(result.kind).toBe("endpoint");
    expect(result.point).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("snaps to an edge midpoint", () => {
    const store = square();
    const result = snap(store.getState(), { x: 500, y: -6, z: 0 });
    expect(result.kind).toBe("midpoint");
    expect(result.point).toEqual({ x: 500, y: 0, z: 0 });
  });

  it("snaps onto an edge", () => {
    const store = square();
    const result = snap(store.getState(), { x: 300, y: 5, z: 0 });
    expect(result.kind).toBe("edge");
    expect(result.point.y).toBeCloseTo(0, 9);
  });

  it("falls back to the drawing plane when nothing is near", () => {
    const store = square();
    const free = { x: 4000, y: 4000, z: 0 };
    const result = snap(store.getState(), free);
    expect(result.kind).toBe("face");
    expect(result.point).toEqual(free);
  });

  it("returns the free point when snapping is disabled", () => {
    const store = square();
    const free = { x: 8, y: 6, z: 0 };
    const result = snap(store.getState(), free, { snapping: false });
    expect(result.kind).toBe("free");
    expect(result.point).toEqual(free);
  });

  it("locks to a pinned axis and still snaps to vertices on it", () => {
    const store = square();
    const lock = createAxisLock("x", 1, ORIGIN);
    const away = snap(store.getState(), { x: 400, y: 300, z: 0 }, { lock });
    expect(away.kind).toBe("axis");
    expect(away.point).toEqual({ x: 400, y: 0, z: 0 });
    expect(away.axisKey).toBe("x");

    const nearVertex = snap(store.getState(), { x: 8, y: 300, z: 0 }, { lock });
    expect(nearVertex.kind).toBe("endpoint");
    expect(nearVertex.point).toEqual({ x: 0, y: 0, z: 0 });

    expect(projectOntoAxis({ x: 5, y: 9, z: 0 }, lock)).toEqual({ x: 5, y: 0, z: 0 });
  });

  it("keeps axis locks working with snapping turned off", () => {
    const store = square();
    const lock = createAxisLock("z", 1, ORIGIN);
    const result = snap(store.getState(), { x: 90, y: 90, z: 250 }, { lock, snapping: false });
    expect(result.kind).toBe("axis");
    expect(result.point).toEqual({ x: 0, y: 0, z: 250 });
    expect(result.axisKey).toBe("z");
  });

  it("infers an axis from the anchor away from any geometry", () => {
    const store = square();
    const anchor = { x: 0, y: -4000, z: 0 };
    const result = snap(store.getState(), { x: 2000, y: -4007, z: 0 }, { anchor, tolerance: 20 });
    expect(result.kind).toBe("axis");
    expect(result.axisKey).toBe("x");
    expect(result.point.y).toBeCloseTo(-4000, 9);
  });

  it("treats the extension of an existing edge as real geometry", () => {
    const store = square();
    const result = snap(store.getState(), { x: 2000, y: 7, z: 0 }, { anchor: { x: 0, y: 0, z: 0 }, tolerance: 20 });
    expect(result.kind).toBe("extension");
    expect(result.point).toEqual({ x: 2000, y: 0, z: 0 });
  });

  it("counts guide lines as snappable edges", () => {
    const store = createStore({ unit: "mm" });
    store.dispatch({
      type: "addEntities",
      entities: buildGuide(store.getState(), { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }).entities,
    });
    const result = snap(store.getState(), { x: 6, y: 5000, z: 0 });
    expect(result.kind).toBe("guide");
    expect(result.point).toEqual({ x: 0, y: 5000, z: 0 });
  });

  it("creates a virtual vertex where two guides cross", () => {
    const store = createStore({ unit: "mm" });
    store.dispatch({
      type: "addEntities",
      entities: buildGuide(store.getState(), { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).entities,
    });
    store.dispatch({
      type: "addEntities",
      entities: buildGuide(store.getState(), { x: 2000, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }).entities,
    });
    const result = snap(store.getState(), { x: 2005, y: 4, z: 0 });
    expect(result.kind).toBe("intersection");
    expect(result.point.x).toBeCloseTo(2000, 6);
    expect(result.point.y).toBeCloseTo(0, 6);
  });

  it("prefers a vertex over an inferred axis when both are in range", () => {
    const store = square();
    const result = snap(store.getState(), { x: 6, y: 4, z: 0 }, { anchor: { x: -1000, y: 0, z: 0 } });
    expect(result.kind).toBe("endpoint");
    expect(result.point).toEqual({ x: 0, y: 0, z: 0 });
  });
});
