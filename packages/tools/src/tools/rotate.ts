import { angle as angleOps, transform, vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { formatAngle, pointIdsForEntities } from "@gabarito/core";
import type { EntityId } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { Tool, ToolContext } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };
const ARC_STEPS = 36;

/**
 * Rotate: click a pivot, then drag around the locked axis (Z by default).
 * A typed value is an angle in degrees.
 */
export function createRotateTool(): Tool {
  let pivot: Vec3 | null = null;
  let reference: Vec3 | null = null;
  let radius = 0;
  let angleValue = 0;
  let pointIds: EntityId[] | null = null;

  const rotationAxis = (ctx: ToolContext): Vec3 =>
    ctx.axisLock ? ctx.axisLock.direction : { x: 0, y: 0, z: 1 };

  const clear = (ctx: ToolContext): void => {
    pivot = null;
    reference = null;
    radius = 0;
    angleValue = 0;
    pointIds = null;
    ctx.preview(CLEAR);
  };

  const commit = (ctx: ToolContext): void => {
    if (!pivot || !pointIds || pointIds.length === 0 || Math.abs(angleValue) < 1e-9) {
      clear(ctx);
      return;
    }
    ctx.dispatch({
      type: "rotate",
      pointIds,
      origin: pivot,
      axis: rotationAxis(ctx),
      angle: angleValue,
    });
    clear(ctx);
  };

  return {
    id: "rotate",
    label: "Rotate",
    shortcut: "Q",
    hint: "Select, click a pivot, then drag. Arrow keys pin the axis (Z by default). Type an angle in degrees and press Enter.",
    numbers: { kind: "angle", max: 1, example: "45", labels: ["angle"] },

    pointerDown(event, ctx) {
      if (!pivot) {
        pivot = event.world;
        pointIds = pointIdsForEntities(ctx.doc, ctx.doc.selection);
        return;
      }
      commit(ctx);
    },

    pointerMove(event, ctx) {
      if (!pivot) return;
      const axis = rotationAxis(ctx);
      const relative = vec3.sub(event.world, pivot);
      const radial = vec3.sub(relative, vec3.scale(axis, vec3.dot(relative, axis)));
      if (vec3.isZero(radial)) return;

      radius = vec3.len(radial);
      if (!reference) reference = vec3.normalize(radial);
      angleValue = angleOps.signedAround(axis, reference, vec3.normalize(radial));

      const start = vec3.add(pivot, vec3.scale(reference, radius));
      const segments: Array<{ a: Vec3; b: Vec3; color?: number }> = [];
      let previous = start;
      for (let step = 1; step <= ARC_STEPS; step += 1) {
        const current = transform.rotatePointAroundAxis(
          start,
          pivot,
          axis,
          (angleValue * step) / ARC_STEPS,
        );
        segments.push({ a: previous, b: current, color: PREVIEW.line });
        previous = current;
      }

      ctx.preview({
        segments,
        polygons: [],
        points: [
          { position: pivot, color: PREVIEW.point },
          { position: previous, color: PREVIEW.point },
        ],
      });
    },

    commitNumbers(values, ctx) {
      if (!pivot) return;
      angleValue = values[0];
      commit(ctx);
    },

    cancel: clear,

    readout() {
      if (!pivot) return null;
      if (!pointIds || pointIds.length === 0) return "Select geometry first, then drag to rotate";
      return formatAngle(angleValue);
    },

    isActive: () => pivot !== null,
    axisAnchor: () => pivot,
  };
}
