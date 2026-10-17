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
import { isCutError, planCut } from "./cut";

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
  store.dispatch({ type: "addEntities", entities: buildExtrusion(doc(), bottom.id, SIDE).entities });

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

describe("planCut", () => {
  it("cuts a recess when the drag goes into the solid", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    expect(facesOf(doc())).toHaveLength(7);

    const plan = planCut(doc(), innerFaceId, -DEPTH);
    expect(isCutError(plan)).toBe(false);
    if (isCutError(plan)) return;

    store.dispatch([
      { type: "removeEntities", ids: plan.remove },
      { type: "addEntities", entities: plan.add },
    ]);

    // The top face became a ring of four, the inner face is gone, the four sides and the bottom
    // survive, and the opening adds four walls and a floor: seven faces become fourteen.
    expect(facesOf(doc())).toHaveLength(14);
    expect(documentVolume(doc())).toBeCloseTo(SIDE * SIDE * SIDE - INNER * INNER * DEPTH, 0);
    expect(everyEdgeSharedTwice(doc())).toBe(true);
  });

  it("cuts right through when the drag exceeds the solid", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    const plan = planCut(doc(), innerFaceId, -SIDE * 2);
    expect(isCutError(plan)).toBe(false);
    if (isCutError(plan)) return;

    store.dispatch([
      { type: "removeEntities", ids: plan.remove },
      { type: "addEntities", entities: plan.add },
    ]);

    // No floor, because the cut passes out the other side: both the top and the bottom become
    // rings, so seven faces become sixteen.
    expect(facesOf(doc())).toHaveLength(16);
    expect(everyEdgeSharedTwice(doc())).toBe(true);
    const rings = facesOf(doc()).filter((face) => facePositions(doc(), face).every((p) => p.z === 0 || p.z === SIDE));
    expect(rings).toHaveLength(8);
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
    if (isCutError(plan)) throw new Error(plan.error);
    store.dispatch([
      { type: "removeEntities", ids: plan.remove },
      { type: "addEntities", entities: plan.add },
    ]);
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
    expect(isCutError(plan)).toBe(true);
  });

  it("refuses a drag that cuts nothing", () => {
    const { innerFaceId, doc } = boxWithInnerFaceOnTop();
    const plan = planCut(doc(), innerFaceId, 300);
    expect(isCutError(plan)).toBe(true);
  });
});
