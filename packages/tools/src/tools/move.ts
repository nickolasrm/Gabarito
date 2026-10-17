import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { edgePositions, facePositions, formatLength, pointIdsForEntities, unitSuffix } from "@gabarito/core";
import type { EntityId } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { Tool, ToolContext, ToolPreview } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };

/** Ghost of what is about to move: faces filled, edges outlined, points marked. */
function movedGhost(ctx: ToolContext, delta: Vec3): ToolPreview {
  const segments: ToolPreview["segments"] = [];
  const polygons: ToolPreview["polygons"] = [];
  const points: ToolPreview["points"] = [];

  for (const id of ctx.doc.selection) {
    const entity = ctx.doc.entities[id];
    if (!entity) continue;

    if (entity.kind === "point") {
      points.push({ position: vec3.add(entity.position, delta), color: PREVIEW.point });
      continue;
    }

    if (entity.kind === "edge") {
      const ends = edgePositions(ctx.doc, entity);
      if (ends) {
        segments.push({
          a: vec3.add(ends[0], delta),
          b: vec3.add(ends[1], delta),
          color: PREVIEW.line,
        });
      }
      continue;
    }

    if (entity.kind === "face") {
      const loop = facePositions(ctx.doc, entity).map((point) => vec3.add(point, delta));
      if (loop.length < 3) continue;
      polygons.push({ points: loop, color: PREVIEW.face, opacity: 0.3 });
      for (let index = 0; index < loop.length; index += 1) {
        segments.push({
          a: loop[index],
          b: loop[(index + 1) % loop.length],
          color: PREVIEW.line,
        });
      }
    }
  }

  return { segments, polygons, points };
}

/**
 * Move: click to grab, the geometry follows the cursor, click to drop. `Esc` puts it back
 * because nothing is applied until the drop. Axis locks constrain the delta to a line.
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
    cursor: "move",
    lockMode: "axis",
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
      ctx.preview(movedGhost(ctx, delta));
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
