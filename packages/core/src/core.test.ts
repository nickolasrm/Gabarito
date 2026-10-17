import { describe, expect, it } from "vitest";
import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import {
  buildEdge,
  buildExtrusion,
  buildGuide,
  buildRectangle,
  createStore,
  edgesOf,
  facesOf,
  formatAngle,
  formatLength,
  formatLengthWithUnit,
  parseAngle,
  parseLength,
  pointsOf,
} from "./index";
import type { DocumentState, Entity, FaceEntity } from "./index";

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const U: Vec3 = { x: 1000, y: 0, z: 0 };
const V: Vec3 = { x: 0, y: 1000, z: 0 };

function rectangleStore() {
  const store = createStore({ unit: "mm" });
  store.dispatch({ type: "addEntities", entities: buildRectangle(store.getState(), ORIGIN, U, V).entities });
  return store;
}

function sharesEdge(face: FaceEntity, a: string, b: string): boolean {
  const loop = face.points;
  for (let index = 0; index < loop.length; index += 1) {
    const current = loop[index];
    const next = loop[(index + 1) % loop.length];
    if ((current === a && next === b) || (current === b && next === a)) return true;
  }
  return false;
}

/** An edge shared by exactly two faces means the solid is closed. */
function closedSolid(doc: DocumentState): boolean {
  const faces = facesOf(doc);
  return edgesOf(doc).every((edge) => {
    const owners = faces.filter((face) => sharesEdge(face, edge.points[0], edge.points[1]));
    return owners.length === 2;
  });
}

describe("commands", () => {
  it("builds a rectangle as four points, four edges and one face", () => {
    const store = rectangleStore();
    const entities: Entity[] = Object.values(store.getState().entities);
    expect(entities.filter((entity) => entity.kind === "point")).toHaveLength(4);
    expect(entities.filter((entity) => entity.kind === "edge")).toHaveLength(4);
    expect(entities.filter((entity) => entity.kind === "face")).toHaveLength(1);
  });

  it("undoes addEntities without leaving anything behind", () => {
    const store = rectangleStore();
    expect(Object.keys(store.getState().entities)).toHaveLength(9);
    expect(store.undo()).toBe(true);
    expect(Object.keys(store.getState().entities)).toHaveLength(0);
    expect(store.canRedo()).toBe(true);
  });

  it("redoes addEntities exactly", () => {
    const store = rectangleStore();
    const before = JSON.stringify(store.getState().entities);
    store.undo();
    store.redo();
    expect(JSON.stringify(store.getState().entities)).toBe(before);
  });

  it("undoes a translate by restoring every position", () => {
    const store = rectangleStore();
    const pointIds = pointsOf(store.getState()).map((point) => point.id);
    const before = JSON.stringify(pointsOf(store.getState()).map((point) => point.position));
    store.dispatch({ type: "translate", pointIds, delta: { x: 250, y: -80, z: 40 } });
    expect(JSON.stringify(pointsOf(store.getState()).map((point) => point.position))).not.toBe(before);
    store.undo();
    expect(JSON.stringify(pointsOf(store.getState()).map((point) => point.position))).toBe(before);
  });

  it("undoes a rotate by rotating back", () => {
    const store = rectangleStore();
    const pointIds = pointsOf(store.getState()).map((point) => point.id);
    const before = JSON.stringify(pointsOf(store.getState()).map((point) => point.position));
    store.dispatch({
      type: "rotate",
      pointIds,
      origin: ORIGIN,
      axis: { x: 0, y: 0, z: 1 },
      angle: Math.PI / 3,
    });
    store.undo();
    const after = pointsOf(store.getState()).map((point) => point.position);
    for (const [index, position] of after.entries()) {
      const original = JSON.parse(before)[index];
      expect(position.x).toBeCloseTo(original.x, 6);
      expect(position.y).toBeCloseTo(original.y, 6);
      expect(position.z).toBeCloseTo(original.z, 6);
    }
  });

  it("restores removed entities, and cascades to what depended on them", () => {
    const store = rectangleStore();
    const face = facesOf(store.getState())[0];
    store.dispatch({ type: "removeEntities", ids: [face.id] });
    expect(facesOf(store.getState())).toHaveLength(0);
    expect(edgesOf(store.getState())).toHaveLength(4);
    store.undo();
    expect(facesOf(store.getState())).toHaveLength(1);
  });

  it("removes a point together with the edges and faces that used it", () => {
    const store = rectangleStore();
    const point = pointsOf(store.getState())[0];
    store.dispatch({ type: "removeEntities", ids: [point.id] });
    expect(pointsOf(store.getState()).length).toBeLessThan(4);
    expect(facesOf(store.getState())).toHaveLength(0);
    store.undo();
    expect(pointsOf(store.getState())).toHaveLength(4);
    expect(facesOf(store.getState())).toHaveLength(1);
  });

  it("round-trips settings and selection", () => {
    const store = createStore();
    store.dispatch({ type: "setSettings", patch: { unit: "ft", snapping: false } });
    expect(store.getState().settings.unit).toBe("ft");
    expect(store.getState().settings.snapping).toBe(false);
    store.undo();
    expect(store.getState().settings.unit).toBe("mm");
    expect(store.getState().settings.snapping).toBe(true);

    store.dispatch({ type: "setSelection", ids: [] });
    expect(store.canUndo()).toBe(false);
  });
});

describe("faces and solids", () => {
  it("closes a face when the fourth line completes the loop", () => {
    const store = createStore();
    const corners: Vec3[] = [ORIGIN, U, vec3.add(U, V), V];
    for (let index = 0; index < 4; index += 1) {
      const built = buildEdge(store.getState(), corners[index], corners[(index + 1) % 4]);
      store.dispatch({ type: "addEntities", entities: built.entities });
    }
    expect(facesOf(store.getState())).toHaveLength(1);
    expect(edgesOf(store.getState())).toHaveLength(4);
    expect(pointsOf(store.getState())).toHaveLength(4);
  });

  it("closes a face when the third line completes a triangle", () => {
    const store = createStore();
    const corners: Vec3[] = [ORIGIN, U, V];
    for (let index = 0; index < 3; index += 1) {
      const built = buildEdge(store.getState(), corners[index], corners[(index + 1) % 3]);
      store.dispatch({ type: "addEntities", entities: built.entities });
    }
    expect(facesOf(store.getState())).toHaveLength(1);
    expect(edgesOf(store.getState())).toHaveLength(3);
    expect(pointsOf(store.getState())).toHaveLength(3);
  });

  it("closes a face on a hand-drawn polygon of 24 sides", () => {
    const store = createStore();
    const ring = Array.from({ length: 24 }, (_, index) => {
      const angle = (index / 24) * Math.PI * 2;
      return { x: Math.cos(angle) * 1400, y: Math.sin(angle) * 1400, z: 0 };
    });
    for (let index = 0; index < ring.length; index += 1) {
      const built = buildEdge(store.getState(), ring[index], ring[(index + 1) % ring.length]);
      if (built.entities.length > 0) {
        store.dispatch({ type: "addEntities", entities: built.entities });
      }
    }
    expect(facesOf(store.getState())).toHaveLength(1);
    expect(pointsOf(store.getState())).toHaveLength(24);
  });

  it("closes a face that reuses a dangling edge's vertex", () => {
    const store = createStore();
    const add = (a: Vec3, b: Vec3) => {
      const built = buildEdge(store.getState(), a, b);
      if (built.entities.length > 0) store.dispatch({ type: "addEntities", entities: built.entities });
    };
    const shared = { x: 0, y: 0, z: 0 };
    add(shared, { x: 1000, y: 0, z: 0 });
    add({ x: 1000, y: 0, z: 0 }, { x: 1000, y: 1000, z: 0 });
    add({ x: 1000, y: 1000, z: 0 }, shared);

    // A line drawn from a vertex that already exists does not close a loop on its own.
    add({ x: 1000, y: 1000, z: 0 }, { x: 4000, y: 3000, z: 0 });
    const before = facesOf(store.getState()).length;

    // Now a second triangle off that dangling tip, sharing its vertex.
    const tip = { x: 4000, y: 3000, z: 0 };
    add(tip, { x: 5000, y: 3000, z: 0 });
    add({ x: 5000, y: 3000, z: 0 }, { x: 4500, y: 4000, z: 0 });
    add({ x: 4500, y: 4000, z: 0 }, tip);

    expect(before).toBe(1);
    expect(facesOf(store.getState())).toHaveLength(2);
  });

  it("welds repeated endpoints instead of duplicating points", () => {
    const store = createStore();
    const first = buildEdge(store.getState(), ORIGIN, U);
    store.dispatch({ type: "addEntities", entities: first.entities });
    const second = buildEdge(store.getState(), U, vec3.add(U, V));
    store.dispatch({ type: "addEntities", entities: second.entities });
    expect(pointsOf(store.getState())).toHaveLength(3);
  });

  it("pushes a face into a closed solid", () => {
    const store = rectangleStore();
    const face = facesOf(store.getState())[0];
    const built = buildExtrusion(store.getState(), face.id, 1000);
    store.dispatch({ type: "addEntities", entities: built.entities });

    expect(pointsOf(store.getState())).toHaveLength(8);
    expect(edgesOf(store.getState())).toHaveLength(12);
    expect(facesOf(store.getState())).toHaveLength(6);
    expect(closedSolid(store.getState())).toBe(true);
  });

  it("reverses an extrusion with undo", () => {
    const store = rectangleStore();
    const face = facesOf(store.getState())[0];
    store.dispatch({ type: "addEntities", entities: buildExtrusion(store.getState(), face.id, 500).entities });
    expect(facesOf(store.getState())).toHaveLength(6);
    store.undo();
    expect(facesOf(store.getState())).toHaveLength(1);
    expect(pointsOf(store.getState())).toHaveLength(4);
  });

  it("stores a guide as a non-geometric entity", () => {
    const store = createStore();
    store.dispatch({ type: "addEntities", entities: buildGuide(store.getState(), ORIGIN, U).entities });
    const guide = Object.values(store.getState().entities)[0];
    expect(guide.kind).toBe("guide");
    expect(facesOf(store.getState())).toHaveLength(0);
  });
});

describe("units", () => {
  it("parses a bare number in the current unit", () => {
    expect(parseLength("100", "mm")).toBe(100);
    expect(parseLength("100", "cm")).toBe(1000);
    expect(parseLength("100", "m")).toBe(100_000);
    expect(parseLength("100", "km")).toBe(1e8);
    expect(parseLength("1", "in")).toBeCloseTo(25.4, 6);
    expect(parseLength("1", "ft")).toBeCloseTo(304.8, 6);
    expect(parseLength("1", "yd")).toBeCloseTo(914.4, 6);
  });

  it("lets an explicit suffix override the current unit", () => {
    expect(parseLength("5m", "mm")).toBe(5000);
    expect(parseLength("2cm", "m")).toBe(20);
    expect(parseLength('12"', "mm")).toBeCloseTo(304.8, 6);
    expect(parseLength("3ft", "mm")).toBeCloseTo(914.4, 6);
    expect(parseLength("1,5", "m")).toBeNull();
  });

  it("rejects malformed input so the buffer can stay visible", () => {
    expect(parseLength("", "mm")).toBeNull();
    expect(parseLength("abc", "mm")).toBeNull();
    expect(parseLength("1.2.3", "mm")).toBeNull();
    expect(parseLength("10 parsecs", "mm")).toBeNull();
  });

  it("round-trips formatting per unit", () => {
    expect(formatLength(1000, "mm")).toBe("1000");
    expect(formatLength(1000, "cm")).toBe("100");
    expect(formatLength(1000, "m")).toBe("1");
    expect(formatLength(1000, "in")).toBe("39.37");
    expect(formatLengthWithUnit(1000, "m")).toBe("1 m");
    expect(formatLength(0, "mm")).toBe("0");
    expect(formatLength(-0, "mm")).toBe("0");
  });

  it("parses angles as degrees unless told otherwise", () => {
    expect(parseAngle("45")).toBeCloseTo(Math.PI / 4, 9);
    expect(parseAngle("90°")).toBeCloseTo(Math.PI / 2, 9);
    expect(formatAngle(Math.PI / 2)).toBe("90°");
  });
});
