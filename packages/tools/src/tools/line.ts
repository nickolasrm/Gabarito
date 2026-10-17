import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { buildEdge, formatLength, unitSuffix } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { Tool, ToolContext } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };

/** Line: click, click. Chains like SketchUp, so a closed loop creates a face. */
export function createLineTool(): Tool {
  let start: Vec3 | null = null;
  let last: Vec3 | null = null;

  const commit = (end: Vec3, ctx: ToolContext): void => {
    if (!start) return;
    const built = buildEdge(ctx.doc, start, end);
    if (built.entities.length === 0) return;
    ctx.dispatch({ type: "addEntities", entities: built.entities });
    // The loop is finished when a face closes, so stop chaining from the last point.
    start = built.entities.some((entity) => entity.kind === "face") ? null : end;
  };

  const lengthText = (ctx: ToolContext): string | null => {
    if (!start || !last) return null;
    return `${formatLength(vec3.dist(start, last), ctx.settings.unit)} ${unitSuffix(ctx.settings.unit)}`;
  };

  return {
    id: "line",
    label: "Line",
    shortcut: "L",
    cursor: "crosshair",
    hint: "Click a start and an end point. Type a length and press Enter, or pin an axis with the arrow keys.",
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
        segments: [{ a: start, b: event.world, color: PREVIEW.line }],
        polygons: [],
        points: [
          { position: start, color: PREVIEW.point },
          { position: event.world, color: PREVIEW.point },
        ],
      });
    },

    commitNumbers(values, ctx) {
      if (!start || !last) return;
      const direction = ctx.axisLock
        ? ctx.axisLock.direction
        : vec3.normalize(vec3.sub(last, start));
      if (vec3.isZero(direction)) return;
      commit(vec3.add(start, vec3.scale(direction, values[0])), ctx);
    },

    cancel(ctx) {
      start = null;
      last = null;
      ctx.preview(CLEAR);
    },

    readout: lengthText,
    isActive: () => start !== null,
    axisAnchor: () => start,
  };
}
