import { beforeAll, describe, expect, it } from "vitest";
import { ensureSolid, vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import {
  buildEdge,
  buildExtrusion,
  buildRectangle,
  createStore,
  edgesOf,
  faceHoles,
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
    // A face with holes contributes its outer fan minus each hole's fan (decision 0023).
    for (const loop of [facePositions(doc, face), ...faceHoles(doc, face)]) {
      for (let index = 1; index < loop.length - 1; index += 1) {
        const a = loop[0];
        const b = loop[index];
        const c = loop[index + 1];
        total += vec3.dot(a, vec3.cross(b, c)) / 6;
      }
    }
  }
  return Math.abs(total);
}

/** A solid is closed when every edge is used by exactly two face loops. */
function everyEdgeSharedTwice(doc: DocumentState): boolean {
  return edgesOf(doc).every((edge) => {
    const owners = facesOf(doc).filter((face) => {
      for (const loop of [face.points, ...(face.holes ?? [])]) {
        for (let index = 0; index < loop.length; index += 1) {
          const a = loop[index];
          const b = loop[(index + 1) % loop.length];
          if (
            (a === edge.points[0] && b === edge.points[1]) ||
            (a === edge.points[1] && b === edge.points[0])
          ) {
            return true;
          }
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
    // A face with holes contributes its outline minus each hole (decision 0023).
    const loops = [facePositions(doc, face), ...faceHoles(doc, face)];
    const along = loops[0].map((point) => point[axis]);
    if (Math.max(...along) - Math.min(...along) > 1e-6) continue;
    if (Math.abs(along[0] - value) > 1e-6) continue;
    let sum = 0;
    for (const [loopIndex, loop] of loops.entries()) {
      let area = 0;
      for (let index = 0; index < loop.length; index += 1) {
        const a = loop[index];
        const b = loop[(index + 1) % loop.length];
        area += (a.x * b.y - b.x * a.y) * (axis === "z" ? 1 : 0);
      }
      // The hole's winding may agree or disagree with the outer loop; only its size matters.
      sum += Math.abs(area / 2) * (loopIndex === 0 ? 1 : -1);
    }
    total += sum;
  }
  return total;
}

describe("planCut", () => {
  beforeAll(async () => {
    // The cut runs on the kernel, which initialises asynchronously; a cut is refused until ready.
    await ensureSolid();
  });

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
    // The border of the opening is one face with one hole, the way the kernel returned it.
    const rings = facesOf(doc()).filter((face) => (face.holes?.length ?? 0) > 0);
    expect(rings).toHaveLength(1);
    expect(rings[0].holes).toHaveLength(1);
    expect(rings[0].holes?.[0]).toHaveLength(4);
    // Pushing the ring itself is refused; the opening's floor is the face to push.
    const pushed = planCut(doc(), rings[0].id, -DEPTH);
    expect(pushed.kind).toBe("refuse");
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

  it("deepens an existing recess by pushing its floor again", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    const first = planCut(doc(), innerFaceId, -DEPTH);
    if (first.kind !== "cut") throw new Error(first.kind);
    apply(store, first);

    // The cavity's floor is the face that lies one depth below the top, a 600² rectangle.
    const floor = facesOf(doc()).find(
      (face) =>
        (face.holes?.length ?? 0) === 0 &&
        facePositions(doc(), face).every((point) => Math.abs(point.z - (SIDE - DEPTH)) < 1e-6),
    );
    expect(floor).toBeDefined();

    const second = planCut(doc(), floor!.id, -DEPTH);
    expect(second.kind).toBe("cut");
    if (second.kind !== "cut") return;
    apply(store, second);

    expect(documentVolume(doc())).toBeCloseTo(SIDE * SIDE * SIDE - INNER * INNER * DEPTH * 2, 0);
    expect(everyEdgeSharedTwice(doc())).toBe(true);
    expect(areaInPlane(doc(), "z", SIDE - DEPTH * 2)).toBeCloseTo(INNER * INNER, 0);
  });

  it("extends the cavity when a cavity wall is pushed in, and rings when a drawn window is cut", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    const first = planCut(doc(), innerFaceId, -DEPTH);
    if (first.kind !== "cut") throw new Error(first.kind);
    apply(store, first);

    // Pushing a cavity wall's whole face inward moves the wall: the cavity grows, no ring.
    const wall = facesOf(doc()).find(
      (face) =>
        (face.holes?.length ?? 0) === 0 &&
        facePositions(doc(), face).every((point) => Math.abs(point.x - 700) < 1e-6),
    );
    expect(wall).toBeDefined();

    const pushed = planCut(doc(), wall!.id, -400);
    expect(pushed.kind).toBe("cut");
    if (pushed.kind !== "cut") return;
    apply(store, pushed);

    expect(documentVolume(doc())).toBeCloseTo(
      SIDE * SIDE * SIDE - INNER * INNER * DEPTH - INNER * DEPTH * 400,
      0,
    );
    expect(everyEdgeSharedTwice(doc())).toBe(true);
    // The wall now stands at x = 300.
    expect(
      facesOf(doc()).some(
        (face) =>
          (face.holes?.length ?? 0) === 0 &&
          facePositions(doc(), face).every((point) => Math.abs(point.x - 300) < 1e-6),
      ),
    ).toBe(true);
  });

  it("cuts a drawn window into a cavity wall, leaving a ring", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    const first = planCut(doc(), innerFaceId, -DEPTH);
    if (first.kind !== "cut") throw new Error(first.kind);
    apply(store, first);

    // A smaller rectangle drawn on the cavity wall, 200 × 300, centred in the 600 × 500 face.
    const drawn = buildRectangle(
      doc(),
      { x: 700, y: 900, z: 1600 },
      { x: 0, y: 200, z: 0 },
      { x: 0, y: 0, z: 300 },
    );
    store.dispatch({ type: "addEntities", entities: drawn.entities });
    const drawnFace = drawn.entities.find((entity) => entity.kind === "face");
    expect(drawnFace).toBeDefined();

    const second = planCut(doc(), drawnFace!.id, -200);
    expect(second.kind).toBe("cut");
    if (second.kind !== "cut") return;
    apply(store, second);

    expect(documentVolume(doc())).toBeCloseTo(
      SIDE * SIDE * SIDE - INNER * INNER * DEPTH - 200 * 300 * 200,
      0,
    );
    expect(everyEdgeSharedTwice(doc())).toBe(true);
    // The wall now holds the window's ring, in its own plane.
    const rings = facesOf(doc()).filter((face) => {
      const points = facePositions(doc(), face);
      return (face.holes?.length ?? 0) > 0 && points.every((point) => Math.abs(point.x - 700) < 1e-6);
    });
    expect(rings).toHaveLength(1);
  });

  it("cuts a rectangle drawn on a cut solid, and the drawing becomes the opening", () => {
    const { store, innerFaceId, doc } = boxWithInnerFaceOnTop();
    const first = planCut(doc(), innerFaceId, -DEPTH);
    if (first.kind !== "cut") throw new Error(first.kind);
    apply(store, first);

    // A smaller rectangle drawn on the cavity's floor, 400² centred in the 600² opening.
    const drawn = buildRectangle(
      doc(),
      { x: 800, y: 800, z: SIDE - DEPTH },
      { x: 400, y: 0, z: 0 },
      { x: 0, y: 400, z: 0 },
    );
    store.dispatch({ type: "addEntities", entities: drawn.entities });
    const drawnFace = drawn.entities.find((entity) => entity.kind === "face");
    expect(drawnFace).toBeDefined();

    const second = planCut(doc(), drawnFace!.id, -300);
    expect(second.kind).toBe("cut");
    if (second.kind !== "cut") return;
    apply(store, second);

    expect(documentVolume(doc())).toBeCloseTo(
      SIDE * SIDE * SIDE - INNER * INNER * DEPTH - 400 * 400 * 300,
      0,
    );
    expect(everyEdgeSharedTwice(doc())).toBe(true);
  });
});
