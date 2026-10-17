import { describe, expect, it } from "vitest";
import { poly as polyOps, vec3 } from "@gabarito/geometry";
import type { Plane } from "@gabarito/geometry";
import {
  buildEdge,
  createStore,
  edgesOf,
  facePositions,
  facesOf,
  getPoint,
  pointsOf,
  type Store,
} from "@gabarito/core";
import { ToolController, type PointerState, type ViewportAdapter } from "./controller";

/** A fixed, non-axis-aligned view direction, so locked planes are representable. */
const VIEW_DIRECTION = { x: 0, y: -Math.SQRT1_2, z: -Math.SQRT1_2 };

/**
 * A stand-in for the viewport. Screen coordinates map onto the ground plane and the ray
 * runs along the view direction, which is enough to exercise the geometry that locked
 * planes and the push/pull plane depend on.
 */
function fakeViewport(store: Store): ViewportAdapter {
  return {
    raycast(x, y) {
      const doc = store.getState();
      for (const face of facesOf(doc)) {
        const positions = facePositions(doc, face);
        if (positions.length < 3) continue;
        const point = { x, y, z: 0 };
        const normal = polyOps.normal(positions);
        if (normal && polyOps.containsPoint(positions, point, 1e-6)) {
          return { entityId: face.id, kind: "face", point, distance: 0 };
        }
      }
      return null;
    },
    rayAt(x, y) {
      return { origin: { x, y, z: 0 }, direction: VIEW_DIRECTION };
    },
    raycastFace(x, y) {
      const doc = store.getState();
      for (const face of facesOf(doc)) {
        const positions = facePositions(doc, face);
        if (positions.length < 3) continue;
        const normal = polyOps.normal(positions);
        if (normal && polyOps.containsPoint(positions, { x, y, z: 0 }, 1e-6)) {
          return { entityId: face.id, kind: "face", point: { x, y, z: 0 }, distance: 0 };
        }
      }
      return null;
    },
    raycastPlane(x, y, plane: Plane) {
      const origin = { x, y, z: 0 };
      const denominator = vec3.dot(VIEW_DIRECTION, plane.normal);
      if (Math.abs(denominator) < 1e-9) return null;
      const t = vec3.dot(vec3.sub(plane.origin, origin), plane.normal) / denominator;
      return vec3.add(origin, vec3.scale(VIEW_DIRECTION, t));
    },
    // Inverse of the ray mapping above: the screen point whose ray passes through P.
    worldToScreen(point) {
      return { x: point.x, y: point.y - point.z, visible: true };
    },
    pixelsPerWorldUnit() {
      return 1;
    },
    viewDirection() {
      return VIEW_DIRECTION;
    },
  };
}

function harness(unit: "mm" | "m" = "mm") {
  const store = createStore({ unit });
  const controller = new ToolController(store, fakeViewport(store), () => {});
  const state = (x: number, y: number): PointerState => ({
    screenX: x,
    screenY: y,
    button: 0,
    buttons: 0,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
  });
  return {
    store,
    controller,
    move: (x: number, y: number) => controller.pointerMove(state(x, y)),
    down: (x: number, y: number) => controller.pointerDown(state(x, y)),
    type: (text: string) => {
      for (const character of text) controller.typedKey(character);
    },
  };
}

function edgeLengths(store: Store): number[] {
  return edgesOf(store.getState()).map((edge) => {
    const a = getPoint(store.getState(), edge.points[0]);
    const b = getPoint(store.getState(), edge.points[1]);
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) : 0;
  });
}

describe("tool controller", () => {
  it("draws a rectangle from two clicks", () => {
    const { store, controller, move, down } = harness();
    controller.setTool("rectangle");
    down(0, 0);
    move(1000, 600);
    expect(controller.getStatus().readout).toBe("1000 × 600 mm");
    down(1000, 600);
    expect(facesOf(store.getState())).toHaveLength(1);
    expect(edgesOf(store.getState())).toHaveLength(4);
  });

  it("draws a rectangle from a typed size in the current unit", () => {
    const { store, controller, down, type } = harness("mm");
    controller.setTool("rectangle");
    down(0, 0);
    type("100,50");
    expect(controller.commitTyped()).toBe(true);

    const face = facesOf(store.getState())[0];
    const positions = facePositions(store.getState(), face);
    const width = Math.max(...positions.map((point) => point.x)) - Math.min(...positions.map((point) => point.x));
    const depth = Math.max(...positions.map((point) => point.y)) - Math.min(...positions.map((point) => point.y));
    expect(width).toBeCloseTo(100, 6);
    expect(depth).toBeCloseTo(50, 6);
  });

  it("interprets typed sizes in the selected unit", () => {
    const { store, controller, down, type } = harness("m");
    controller.setTool("rectangle");
    down(0, 0);
    type("100,50");
    expect(controller.commitTyped()).toBe(true);

    const positions = facePositions(store.getState(), facesOf(store.getState())[0]);
    const width = Math.max(...positions.map((point) => point.x)) - Math.min(...positions.map((point) => point.x));
    expect(width).toBeCloseTo(100_000, 4);
  });

  it("makes a square from a single typed value", () => {
    const { store, controller, down, type } = harness("mm");
    controller.setTool("rectangle");
    down(0, 0);
    type("250");
    controller.commitTyped();
    expect(edgeLengths(store).every((length) => Math.abs(length - 250) < 1e-6)).toBe(true);
  });

  it("leaves the buffer alone when the typed value is malformed", () => {
    const { controller, down, type } = harness("mm");
    controller.setTool("rectangle");
    down(0, 0);
    type("1.2.3");
    expect(controller.commitTyped()).toBe(false);
    expect(controller.getStatus().typed).toBe("1.2.3");
  });

  it("draws a circle from a typed radius", () => {
    const { store, controller, down, type } = harness("mm");
    controller.setTool("circle");
    down(0, 0);
    type("10");
    controller.commitTyped();
    expect(facesOf(store.getState())).toHaveLength(1);
    expect(edgesOf(store.getState())).toHaveLength(24);
    expect(edgeLengths(store)[0]).toBeLessThan(10);
  });

  it("pins an axis with the arrow keys", () => {
    const { store, controller, move, down } = harness();
    controller.setTool("line");
    down(0, 0);
    expect(controller.pressKey("ArrowRight", false)).toBe(true);
    move(500, 300);
    expect(controller.getStatus().axisKey).toBe("x");
    expect(controller.getStatus().snapLabel).toContain("X axis");
    down(500, 300);

    const edge = edgesOf(store.getState())[0];
    const a = getPoint(store.getState(), edge.points[0]);
    const b = getPoint(store.getState(), edge.points[1]);
    expect(a).not.toBeNull();
    expect(b?.y).toBeCloseTo(0, 9);
    expect(b?.z).toBeCloseTo(0, 9);
    expect(b?.x).toBeCloseTo(500, 9);
  });

  it("clears the axis lock on Escape and cancels the operation", () => {
    const { store, controller, move, down } = harness();
    controller.setTool("line");
    down(0, 0);
    controller.pressKey("ArrowRight", false);
    controller.cancel();
    expect(controller.getStatus().axisKey).toBeNull();
    expect(controller.getStatus().active).toBe(false);
    move(500, 300);
    expect(edgesOf(store.getState())).toHaveLength(0);
  });

  it("pushes a face into a solid, and undoes it", () => {
    const { store, controller, down, type } = harness();
    controller.setTool("rectangle");
    down(0, 0);
    type("1000");
    controller.commitTyped();
    expect(facesOf(store.getState())).toHaveLength(1);

    controller.setTool("pushpull");
    down(500, 500);
    expect(controller.getStatus().active).toBe(true);
    type("500");
    expect(controller.commitTyped()).toBe(true);
    expect(facesOf(store.getState())).toHaveLength(6);
    expect(pointsOf(store.getState())).toHaveLength(8);

    store.undo();
    expect(facesOf(store.getState())).toHaveLength(1);
  });

  it("moves the selection along a pinned axis by a typed distance", () => {
    const { store, controller, down, type } = harness();
    controller.setTool("rectangle");
    down(0, 0);
    type("1000");
    controller.commitTyped();

    controller.setTool("select");
    down(500, 500);
    const face = facesOf(store.getState())[0];
    expect(store.getState().selection).toEqual([face.id]);

    controller.setTool("move");
    down(0, 0);
    controller.pressKey("ArrowRight", false);
    type("250");
    controller.commitTyped();

    const positions = facePositions(store.getState(), facesOf(store.getState())[0]);
    expect(Math.min(...positions.map((point) => point.x))).toBeCloseTo(250, 6);
    expect(Math.max(...positions.map((point) => point.y))).toBeCloseTo(1000, 6);
  });

  it("rotates the selection by a typed angle", () => {
    const { store, controller, down, type } = harness();
    controller.setTool("rectangle");
    down(0, 0);
    type("1000,400");
    controller.commitTyped();

    controller.setTool("select");
    down(500, 200);
    controller.setTool("rotate");
    down(0, 0);
    type("90");
    controller.commitTyped();

    const positions = facePositions(store.getState(), facesOf(store.getState())[0]);
    const maxX = Math.max(...positions.map((point) => point.x));
    const minX = Math.min(...positions.map((point) => point.x));
    const maxY = Math.max(...positions.map((point) => point.y));
    expect(maxX - minX).toBeCloseTo(400, 4);
    expect(maxY).toBeCloseTo(1000, 4);
  });

  it("creates a guide with the ruler and a dimension with the measure tool", () => {
    const { store, controller, move, down } = harness();
    controller.setTool("ruler");
    down(0, 0);
    move(1000, 0);
    expect(controller.getStatus().readout).toContain("1000");
    down(1000, 0);
    expect(Object.values(store.getState().entities).some((entity) => entity.kind === "guide")).toBe(true);

    controller.setTool("measure");
    down(0, 0);
    move(0, 750);
    down(0, 750);
    const dimensions = Object.values(store.getState().entities).filter((entity) => entity.kind === "dimension");
    expect(dimensions).toHaveLength(1);
  });

  // Regression tests for the six reported bugs.

  it("closes a face when three lines form a triangle", () => {
    const { store, controller, down } = harness();
    controller.setTool("line");
    down(0, 0);
    down(1000, 0);
    down(0, 600);
    down(0, 0);
    const state = store.getState();
    expect(facesOf(state)).toHaveLength(1);
    expect(edgesOf(state)).toHaveLength(3);
    expect(pointsOf(state)).toHaveLength(3);
  });

  it("makes a rectangle vertical when Z is pinned", () => {
    const { store, controller, move, down } = harness();
    controller.setTool("rectangle");
    down(0, 0);
    controller.pressKey("ArrowUp", false);
    move(400, 300);
    expect(controller.getStatus().axisKey).toBe("z");
    down(400, 300);

    const positions = facePositions(store.getState(), facesOf(store.getState())[0]);
    const zs = positions.map((point) => point.z);
    const ys = positions.map((point) => point.y);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1);
    // Vertical: no depth away from the plane that contains Z.
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1e-6);
  });

  it("draws a vertical edge when Z is pinned", () => {
    const { store, controller, move, down } = harness();
    controller.setTool("line");
    down(0, 0);
    controller.pressKey("ArrowUp", false);
    move(0, 300);
    down(0, 300);

    const edge = edgesOf(store.getState())[0];
    const a = getPoint(store.getState(), edge.points[0]);
    const b = getPoint(store.getState(), edge.points[1]);
    expect(a).not.toBeNull();
    expect(Math.abs((b?.z ?? 0) - (a?.z ?? 0))).toBeGreaterThan(1);
  });

  it("extrudes a face by dragging on the pull plane, not the face plane", () => {
    const { store, controller, move, down, type } = harness();
    controller.setTool("rectangle");
    down(0, 0);
    type("1000");
    controller.commitTyped();

    controller.setTool("pushpull");
    down(500, 500);
    expect(controller.getStatus().active).toBe(true);

    move(500, 200);
    expect(controller.getStatus().readout).not.toBe("0 mm");
    down(500, 200);

    expect(facesOf(store.getState())).toHaveLength(6);
    expect(pointsOf(store.getState())).toHaveLength(8);
  });

  it("previews the geometry that is about to move, not connector lines", () => {
    const { store, controller, move, down, type } = harness();
    controller.setTool("rectangle");
    down(0, 0);
    type("1000");
    controller.commitTyped();

    controller.setTool("select");
    down(500, 500);
    expect(store.getState().selection).toHaveLength(1);

    controller.setTool("move");
    down(500, 500);
    move(700, 400);

    const preview = controller.getPreview();
    expect(preview.polygons).toHaveLength(1);
    expect(preview.segments).toHaveLength(4);
  });

  it("snaps to a vertex that is not on the drawing plane", () => {
    const { store, controller, down } = harness();
    // An edge floating 400 above the ground.
    store.dispatch({
      type: "addEntities",
      entities: buildEdge(store.getState(), { x: 0, y: 0, z: 400 }, { x: 1000, y: 0, z: 400 }).entities,
    });
    const before = pointsOf(store.getState()).length;

    controller.setTool("line");
    // Screen position of the elevated vertex: the fake projects (x, y - z).
    down(1000, -400);

    expect(controller.getStatus().snapLabel).toBe("Endpoint");
    expect(pointsOf(store.getState())).toHaveLength(before);
  });

  it("stops chaining once an edge closes a face", () => {
    const { controller, down } = harness();
    controller.setTool("line");
    down(0, 0);
    down(1000, 0);
    down(0, 800);
    expect(controller.getStatus().active).toBe(true);
    down(0, 0); // closes the triangle
    expect(controller.getStatus().active).toBe(false);
  });

  it("follows the height axis without pinning it", () => {
    const { store, controller, move, down } = harness();
    controller.setTool("line");
    down(0, 0);
    // Straight up the screen from the anchor: the blue axis is inferred, no arrow key.
    move(0, 300);
    expect(controller.getStatus().snapLabel).toContain("Z axis");
    expect(controller.getStatus().axisKey).toBeNull();
    down(0, 300);

    const edge = edgesOf(store.getState())[0];
    const a = getPoint(store.getState(), edge.points[0]);
    const b = getPoint(store.getState(), edge.points[1]);
    expect(Math.abs((b?.z ?? 0) - (a?.z ?? 0))).toBeGreaterThan(1);
  });

  it("does not bind to an axis the pointer is nowhere near", () => {
    const { store, controller, move, down } = harness();
    controller.setTool("line");
    down(0, 0);
    move(600, 400);
    expect(controller.getStatus().snapLabel).not.toContain("axis");
    down(600, 400);
    expect(edgesOf(store.getState())).toHaveLength(1);
  });

  it("closes the loop when the last click is a few pixels short of the vertex", () => {
    const { store, controller, down } = harness();
    controller.setTool("line");
    down(0, 0);
    down(1000, 0);
    down(500, 900);
    down(9, 11); // near the first vertex, not on it
    expect(facesOf(store.getState())).toHaveLength(1);
    expect(pointsOf(store.getState())).toHaveLength(3);
  });

  it("puts the geometry back when a move is cancelled", () => {
    const { store, controller, move, down, type } = harness();
    controller.setTool("rectangle");
    down(0, 0);
    type("1000");
    controller.commitTyped();
    const before = JSON.stringify(pointsOf(store.getState()).map((point) => point.position));

    controller.setTool("select");
    down(500, 500);
    controller.setTool("move");
    down(0, 0);
    move(600, 600);
    controller.cancel();

    expect(JSON.stringify(pointsOf(store.getState()).map((point) => point.position))).toBe(before);
    expect(controller.getPreview().polygons).toHaveLength(0);
  });
});
