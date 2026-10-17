import type { Vec3 } from "@gabarito/geometry";
import { entityLabel, facePositions, getPoint } from "@gabarito/core";
import type { DocumentState, Entity, EntityId } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { Tool } from "../types";

/** The points of an entity used for a geometric test. */
function samplePoints(doc: DocumentState, entity: Entity): Vec3[] {
  switch (entity.kind) {
    case "point":
      return [entity.position];
    case "edge": {
      const a = getPoint(doc, entity.points[0]);
      const b = getPoint(doc, entity.points[1]);
      return a && b ? [a, b] : [];
    }
    case "face":
      return facePositions(doc, entity);
    case "guide":
      return [entity.origin];
    case "dimension":
      return [entity.a, entity.b];
  }
}

/**
 * Select: click an entity, Shift-click to add or remove, drag on empty space to select
 * everything enclosed by the box.
 */
export function createSelectTool(): Tool {
  let anchor: { screenX: number; screenY: number; world: Vec3 } | null = null;
  let cursor = { x: 0, y: 0 };

  const rect = () => ({
    minX: Math.min(anchor!.screenX, cursor.x),
    maxX: Math.max(anchor!.screenX, cursor.x),
    minY: Math.min(anchor!.screenY, cursor.y),
    maxY: Math.max(anchor!.screenY, cursor.y),
  });

  return {
    id: "select",
    label: "Select",
    shortcut: "Space",
    hint: "Click to select. Shift-click to add. Drag a box to select what it encloses. Delete removes.",

    pointerDown(event, ctx) {
      cursor = { x: event.screenX, y: event.screenY };
      const hit = ctx.pick(event.screenX, event.screenY);
      if (hit) {
        anchor = null;
        const selection = ctx.doc.selection;
        if (event.shiftKey) {
          ctx.dispatch({
            type: "setSelection",
            ids: selection.includes(hit.entityId)
              ? selection.filter((id) => id !== hit.entityId)
              : [...selection, hit.entityId],
          });
        } else {
          ctx.dispatch({ type: "setSelection", ids: [hit.entityId] });
        }
        return;
      }
      anchor = { screenX: event.screenX, screenY: event.screenY, world: event.world };
      if (!event.shiftKey) ctx.dispatch({ type: "setSelection", ids: [] });
    },

    pointerMove(event, ctx) {
      if (!anchor) return;
      cursor = { x: event.screenX, y: event.screenY };
      const plane = ctx.viewPlaneAt(anchor.world);
      const corners: Vec3[] = [];
      for (const [x, y] of [
        [anchor.screenX, anchor.screenY],
        [cursor.x, anchor.screenY],
        [cursor.x, cursor.y],
        [anchor.screenX, cursor.y],
      ]) {
        const point = ctx.worldOnPlane(x, y, plane);
        if (!point) return;
        corners.push(point);
      }
      ctx.preview({
        segments: [],
        polygons: [{ points: corners, color: PREVIEW.face, opacity: 0.18 }],
        points: [],
      });
    },

    pointerUp(_event, ctx) {
      if (!anchor) return;
      const bounds = rect();
      anchor = null;
      ctx.preview({ segments: [], polygons: [], points: [] });

      if (bounds.maxX - bounds.minX < 4 && bounds.maxY - bounds.minY < 4) {
        ctx.dispatch({ type: "setSelection", ids: [] });
        return;
      }

      const ids: EntityId[] = [];
      for (const entity of Object.values(ctx.doc.entities)) {
        const points = samplePoints(ctx.doc, entity);
        if (points.length === 0) continue;
        const enclosed = points.every((point) => {
          const projected = ctx.project(point);
          return (
            projected.visible &&
            projected.x >= bounds.minX &&
            projected.x <= bounds.maxX &&
            projected.y >= bounds.minY &&
            projected.y <= bounds.maxY
          );
        });
        if (enclosed) ids.push(entity.id);
      }
      ctx.dispatch({ type: "setSelection", ids });
    },

    cancel(ctx) {
      anchor = null;
      ctx.preview({ segments: [], polygons: [], points: [] });
    },

    readout(ctx) {
      const selection = ctx.doc.selection;
      if (selection.length === 0) return null;
      if (selection.length === 1) return `1 ${entityLabel(ctx.doc, selection[0])} selected`;
      return `${selection.length} entities selected`;
    },

    isActive() {
      return anchor !== null;
    },
  };
}
