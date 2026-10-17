import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { formatLength, getPoint, pointIdsForEntities, unitSuffix } from "@gabarito/core";
import type { EntityId } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { Tool, ToolContext } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };

/**
 * Move: click to grab the selection, move, click to drop — so a distance can be typed
 * between the clicks. Axis locks constrain the delta. No copy modifier yet.
 */
export function createMoveTool(): Tool {
  let pointIds: EntityId[] | null = null;
  let start: Vec3 | null = null;
  let delta: Vec3 = { x: 0, y: 0, z: 0 };
  let direction: Vec3 | null = null;

  const clear = (ctx: ToolContext): void => {
    pointIds = null;
    start = null;
    delta = { x: 0, y: 0, z: 0 };
    direction = null;
    ctx.preview(CLEAR);
  };

  return {
    id: "move",
    label: "Move",
    shortcut: "M",
    hint: "Select, then click, move and click again. Type a distance and press Enter. Arrow keys pin an axis.",
    numbers: { kind: "length", max: 1, example: "100", labels: ["distance"] },

    pointerDown(event, ctx) {
      if (pointIds && start) {
        if (vec3.isZero(delta)) {
          clear(ctx);
          return;
        }
        ctx.dispatch({ type: "translate", pointIds, delta });
        clear(ctx);
        return;
      }

      let ids = ctx.doc.selection;
      if (ids.length === 0) {
        const hit = ctx.pick(event.screenX, event.screenY);
        if (!hit) return;
        ids = [hit.entityId];
        ctx.dispatch({ type: "setSelection", ids });
      }
      const points = pointIdsForEntities(ctx.doc, ids);
      if (points.length === 0) return;
      pointIds = points;
      start = event.world;
      delta = { x: 0, y: 0, z: 0 };
    },

    pointerMove(event, ctx) {
      if (!pointIds || !start) return;
      delta = vec3.sub(event.world, start);
      if (!vec3.isZero(delta)) direction = vec3.normalize(delta);

      const segments: Array<{ a: Vec3; b: Vec3; color?: number }> = [];
      for (const id of pointIds) {
        const point = getPoint(ctx.doc, id);
        if (point) segments.push({ a: point, b: vec3.add(point, delta), color: PREVIEW.line });
      }
      ctx.preview({ segments, polygons: [], points: [] });
    },

    commitNumbers(values, ctx) {
      if (!pointIds) return;
      const axis = ctx.axisLock ? ctx.axisLock.direction : direction;
      if (!axis || vec3.isZero(axis)) return;
      ctx.dispatch({ type: "translate", pointIds, delta: vec3.scale(axis, values[0]) });
      clear(ctx);
    },

    cancel: clear,

    readout(ctx) {
      if (!pointIds) return null;
      const length = vec3.len(delta);
      if (length < 1e-6) return null;
      return `${formatLength(length, ctx.settings.unit)} ${unitSuffix(ctx.settings.unit)}`;
    },

    isActive: () => pointIds !== null,
    axisAnchor: () => start,
  };
}
