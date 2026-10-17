import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { buildDimension, formatLength, unitSuffix } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { Tool, ToolContext } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };

/**
 * Measure: two clicks report the distance and leave a dimension entity behind.
 * Dimensions are annotations, not geometry (decision 0014).
 */
export function createMeasureTool(): Tool {
  let start: Vec3 | null = null;
  let last: Vec3 | null = null;

  const commit = (end: Vec3, ctx: ToolContext): void => {
    if (!start) return;
    const built = buildDimension(ctx.doc, start, end);
    if (built.entities.length > 0) ctx.dispatch({ type: "addEntities", entities: built.entities });
    start = null;
    last = null;
    ctx.preview(CLEAR);
  };

  return {
    id: "measure",
    label: "Measure",
    shortcut: "Shift+T",
    hint: "Click two points to measure and leave a dimension. Arrow keys pin an axis; type a length and press Enter.",
    numbers: { kind: "length", max: 1, example: "100", labels: ["length"] },

    pointerDown(event, ctx) {
      last = event.world;
      if (!start) {
        start = event.world;
        return;
      }
      commit(event.world, ctx);
    },

    pointerMove(event, ctx) {
      last = event.world;
      if (!start) return;
      ctx.preview({
        segments: [{ a: start, b: event.world, color: PREVIEW.dimension }],
        polygons: [],
        points: [
          { position: start, color: PREVIEW.point },
          { position: event.world, color: PREVIEW.point },
        ],
      });
    },

    commitNumbers(values, ctx) {
      if (!start || !last) return;
      const direction = ctx.axisLock ? ctx.axisLock.direction : vec3.normalize(vec3.sub(last, start));
      if (vec3.isZero(direction)) return;
      commit(vec3.add(start, vec3.scale(direction, values[0])), ctx);
    },

    cancel(ctx) {
      start = null;
      last = null;
      ctx.preview(CLEAR);
    },

    readout(ctx) {
      if (!start || !last) return null;
      const suffix = unitSuffix(ctx.settings.unit);
      const delta = vec3.sub(last, start);
      return `Δ ${formatLength(delta.x, ctx.settings.unit)}, ${formatLength(
        delta.y,
        ctx.settings.unit,
      )}, ${formatLength(delta.z, ctx.settings.unit)} ${suffix}  ·  ${formatLength(
        vec3.len(delta),
        ctx.settings.unit,
      )} ${suffix}`;
    },

    isActive: () => start !== null,
    axisAnchor: () => start,
  };
}
