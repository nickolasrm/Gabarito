import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ensureSolid } from "@gabarito/geometry";
import { buildExtrusion, buildRectangle, createStore, facePositions, facesOf, planCut } from "@gabarito/core";
import { createSceneGraph, rebuildScene } from "./build-scene";

describe("a face with holes renders as one region", () => {
  it("renders the ring from its own vertices, hole included", async () => {
    await ensureSolid();
    const store = createStore();
    const doc = () => store.getState();
    const SIDE = 2000;
    const INNER = 600;
    store.dispatch({
      type: "addEntities",
      entities: buildRectangle(doc(), { x: 0, y: 0, z: 0 }, { x: SIDE, y: 0, z: 0 }, { x: 0, y: SIDE, z: 0 }).entities,
    });
    const bottom = facesOf(doc())[0];
    const ext = buildExtrusion(doc(), bottom.id, SIDE);
    store.dispatch([
      { type: "removeEntities", ids: ext.removeFaceIds ?? [] },
      { type: "addEntities", entities: ext.entities },
    ]);
    const inset = (SIDE - INNER) / 2;
    store.dispatch({
      type: "addEntities",
      entities: buildRectangle(doc(), { x: inset, y: inset, z: SIDE }, { x: INNER, y: 0, z: 0 }, { x: 0, y: INNER, z: 0 }).entities,
    });
    const innerFace = facesOf(doc()).find(
      (face) => face.kind === "face" && facePositions(doc(), face).every((p) => Math.abs(p.z - SIDE) < 1e-6 && p.x > 1),
    );
    const plan = planCut(doc(), innerFace!.id, -500);
    if (plan.kind !== "cut") throw new Error((plan as { error?: string }).error);
    store.dispatch([
      { type: "removeEntities", ids: plan.remove },
      { type: "addEntities", entities: plan.add },
    ]);

    const graph = createSceneGraph();
    rebuildScene(graph, doc());

    // Every vertex pushed must be referenced by a triangle. The failure this pins down: a face with
    // holes whose vertices were never pushed — its triangles then landed on other faces' vertices
    // and the solid rendered torn.
    let positions = 0;
    const used = new Set<number>();
    for (const mesh of graph.faces.children as THREE.Mesh[]) {
      const geometry = mesh.geometry;
      const count = geometry.getAttribute("position").count;
      const index = geometry.getIndex();
      if (!index) continue;
      positions += count;
      for (let i = 0; i < index.count; i += 1) {
        expect(index.getX(i)).toBeLessThan(count);
        used.add(index.getX(i));
      }
    }
    expect(used.size).toBe(positions);
  });
});
