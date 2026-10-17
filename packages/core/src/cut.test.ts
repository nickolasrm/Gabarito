import { describe, expect, it } from "vitest";
import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import {
  buildEdge,
  buildExtrusion,
  buildRectangle,
  createStore,
  edgesOf,
  facePositions,
  facesOf,
} from "./index";
import type { DocumentState, EntityId } from "./index";
import { planCut } from "./cut";

const SIDE = 2000;
const INNER = 600;
const DEPTH = 500;

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const U: Vec3 = { x: SIDE, y: 0, z: 0 };
const V: Vec3 = { x: 0, y: SIDE, z: 0 };

/**
 * Signed-tetrahedron volume of whatever faces the document currently holds.
 *
 * Fan-triangulated in loop order on purpose: `triangulate.polygon` normalises each polygon to a
 * normal of its own choosing, which throws away the winding this sum depends on.
 */
function documentVolume(doc: DocumentState): number {
  let total = 0;
  for (const face of facesOf(doc)) {
    const points = facePositions(doc, face);
    for (let index = 1; index < points.length - 1; index += 1) {
      const a = points[0];
      const b = points[index];
      const c = points[index + 1];
      total += vec3.dot(a, vec3.cross(b, c)) / 6;
    }
  }
  return Math.abs(total);
}

/** A solid is closed when every edge is used by exactly two face loops. */
function everyEdgeSharedTwice(doc: DocumentState): boolean {
  return edgesOf(doc).every((edge) => {
    const owners = facesOf(doc).filter((face) => {
      for (let index = 0; index < face.points.length; index += 1) {
        const a = face.points[index];
        const b = face.points[(index + 1) % face.points.length];
        if (
          (a === edge.points[0] && b === edge.points[1]) ||
          (a === edge.points[1] && b === edge.points[0])
        ) {
          return true;
        }
      }
      return false;
    });
    return owners.length === 2;
  });
}

/** A box with a smaller rectangle drawn inside its top face, which is the reported scene. */
function boxWithInnerFaceOnTop() {
  const store = createStore({ unit: "mm" });
  const doc = () => store.getState();
  store.dispatch({ type: "addEntities", entities: buildRectangle(doc(), ORIGIN, U, V).entities });
  const bottom = facesOf(doc())[0];
  const box = buildExtrusion(doc(), bottom.id, SIDE);
  store.dispatch([
    { type: "removeEntities", ids: box.removeFaceIds ?? [] },
    { type: "addEntities", entities: box.entities },
  ]);

  const inset = (SIDE - INNER) / 2;
  const inner = buildRectangle(
    doc(),
    { x: inset, y: inset, z: SIDE },
    { x: INNER, y: 0, z: 0 },
    { x: 0, y: INNER, z: 0 },
  );
  store.dispatch({ type: "addEntities", entities: inner.entities });
  const innerFace = facesOf(doc()).find((face) =>
    facePositions(doc(), face).every((point) => Math.abs(point.z - SIDE) < 1e-6 && point.x > 1),
  );
  return { store, innerFaceId: innerFace?.id as EntityId, doc };
}

/** Apply a cut plan the way the push/pull tool does, as one transaction. */
function apply(store: ReturnType<typeof createStore>, plan: ReturnType<typeof planCut>): void {
  if (plan.kind !== "cut") throw new Error(`expected a cut, got ${plan.kind}`);
  store.dispatch([
    { type: "removeEntities", ids: plan.remove },
    { type: "addEntities", entities: plan.add },
  ]);
}

/** Sum of face areas lying in the plane `value` along `axis`. */
function areaInPlane(doc: DocumentState, axis: "x" | "y" | "z", value: number): number {
  let total = 0;
  for (const face of facesOf(doc)) {
    const points = facePositions(doc, face);
    const along = points.map((point) => point[axis]);
    if (Math.max(...along) - Math.min(...along) > 1e-6) continue;
    if (Math.abs(along[0] - value) > 1e-6) continue;
    let sum = 0;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      sum += (a.x * b.y - b.x * a.y) * (axis === "z" ? 1 : 0);
    }
    total += Math.abs(sum / 2);
  }
  return total;
}

describe("planCut", () => {
  it("cuts a recess when the drag goes into the solid", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    expect(facesOf(doc())).toHaveLength(7);

    const plan = planCut(doc(), innerFaceId, -DEPTH);
    expect(plan.kind).toBe("cut");
    if (plan.kind !== "cut") return;

    apply(store, plan);

    // The invariants that matter: the material is really gone, the shell still closes, and the
    // top plane now holds the ring rather than the two stacked faces we started with.
    expect(documentVolume(doc())).toBeCloseTo(SIDE * SIDE * SIDE - INNER * INNER * DEPTH, 0);
    expect(everyEdgeSharedTwice(doc())).toBe(true);
    expect(areaInPlane(doc(), "z", SIDE)).toBeCloseTo(SIDE * SIDE - INNER * INNER, 0);
    // The opening has a floor at the drag depth.
    expect(areaInPlane(doc(), "z", SIDE - DEPTH)).toBeCloseTo(INNER * INNER, 0);
  });

  it("cuts right through when the drag exceeds the solid", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    const plan = planCut(doc(), innerFaceId, -SIDE * 2);
    expect(plan.kind).toBe("cut");
    if (plan.kind !== "cut") return;

    apply(store, plan);

    // No floor, because the cut passes out the other side: both large faces become rings.
    expect(documentVolume(doc())).toBeCloseTo(SIDE * SIDE * SIDE - INNER * INNER * SIDE, 0);
    expect(everyEdgeSharedTwice(doc())).toBe(true);
    expect(areaInPlane(doc(), "z", 0)).toBeCloseTo(SIDE * SIDE - INNER * INNER, 0);
    expect(areaInPlane(doc(), "z", SIDE)).toBeCloseTo(SIDE * SIDE - INNER * INNER, 0);
  });

  it("undoes a cut exactly", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    // Compare as a set: restoring entities re-inserts them, so key order differs.
    const snapshot = (state: DocumentState) =>
      JSON.stringify(
        Object.values(state.entities).sort((a, b) => (a.id < b.id ? -1 : 1)),
      );
    const before = snapshot(doc());

    const plan = planCut(doc(), innerFaceId, -DEPTH);
    if (plan.kind !== "cut") throw new Error(plan.kind);
    apply(store, plan);
    expect(snapshot(doc())).not.toBe(before);

    store.undo();
    expect(snapshot(doc())).toBe(before);
  });

  it("refuses a face that is not a rectangle", () => {
    const store = createStore();
    const doc = () => store.getState();
    store.dispatch({ type: "addEntities", entities: buildRectangle(doc(), ORIGIN, U, V).entities });
    // A triangle drawn inside the rectangle, so the shell is not a box of rectangles.
    const a = buildEdge(doc(), { x: 200, y: 200, z: 0 }, { x: 800, y: 200, z: 0 });
    store.dispatch({ type: "addEntities", entities: a.entities });
    const b = buildEdge(doc(), { x: 800, y: 200, z: 0 }, { x: 500, y: 700, z: 0 });
    store.dispatch({ type: "addEntities", entities: b.entities });
    const c = buildEdge(doc(), { x: 500, y: 700, z: 0 }, { x: 200, y: 200, z: 0 });
    store.dispatch({ type: "addEntities", entities: c.entities });

    const triangle = facesOf(doc()).find((face) => face.points.length === 3);
    expect(triangle).toBeDefined();
    const plan = planCut(doc(), triangle?.id as EntityId, -200);
    expect(plan.kind).toBe("refuse");
  });

  it("adds material when the drag points out of the solid", () => {
    const { innerFaceId, doc } = boxWithInnerFaceOnTop();
    const plan = planCut(doc(), innerFaceId, 300);
    expect(plan.kind).toBe("extrude");
  });

  it("adds material when there is no solid at all, as push/pull always has", () => {
    const store = createStore();
    store.dispatch({ type: "addEntities", entities: buildRectangle(store.getState(), ORIGIN, U, V).entities });
    const face = facesOf(store.getState())[0];
    expect(planCut(store.getState(), face.id, 500).kind).toBe("extrude");
  });
});
