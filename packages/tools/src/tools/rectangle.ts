import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { buildRectangle, formatLength, unitSuffix } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { DrawingPlane, Tool, ToolContext } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };

/** Identifies the active axis lock, so the drawing plane can follow it when it changes. */
function lockKey(ctx: ToolContext): string | null {
  if (!ctx.axisLock) return null;
  const { axisKey, direction } = ctx.axisLock;
  return `${axisKey}${direction.x + direction.y + direction.z < 0 ? "-" : "+"}`;
}

/** Rectangle: two clicks on the diagonal, or a typed `width, depth`. */
export function createRectangleTool(): Tool {
  let anchor: { corner: Vec3; plane: DrawingPlane; lock: string | null } | null = null;
  let extents = { u: 0, v: 0 };

  const cornersFrom = (corner: Vec3, plane: DrawingPlane, u: number, v: number): Vec3[] => [
    corner,
    vec3.add(corner, vec3.scale(plane.u, u)),
    vec3.add(corner, vec3.add(vec3.scale(plane.u, u), vec3.scale(plane.v, v))),
    vec3.add(corner, vec3.scale(plane.v, v)),
  ];

  const commit = (u: number, v: number, ctx: ToolContext): void => {
    if (!anchor) return;
    if (Math.abs(u) < 1e-6 || Math.abs(v) < 1e-6) return;
    const built = buildRectangle(
      ctx.doc,
      anchor.corner,
      vec3.scale(anchor.plane.u, u),
      vec3.scale(anchor.plane.v, v),
    );
    if (built.entities.length === 0) return;
    ctx.dispatch({ type: "addEntities", entities: built.entities });
    anchor = null;
    extents = { u: 0, v: 0 };
    ctx.preview(CLEAR);
  };

  return {
    id: "rectangle",
    label: "Rectangle",
    shortcut: "R",
    cursor: "crosshair",
    lockMode: "plane",
    hint: "Click a corner, then the opposite one. Type `width, depth` and press Enter. Arrow keys set the plane (↑ makes it vertical).",
    numbers: { kind: "length", max: 2, example: "100, 50", labels: ["width", "depth"] },

    pointerDown(event, ctx) {
      if (!anchor) {
        anchor = {
          corner: event.world,
          plane: ctx.planeAt(event.screenX, event.screenY),
          lock: lockKey(ctx),
        };
        return;
      }
      commit(extents.u, extents.v, ctx);
    },

    pointerMove(event, ctx) {
      if (!anchor) return;
      // Pinning an axis after the first click changes which plane the shape lives on.
      const key = lockKey(ctx);
      if (key !== anchor.lock) {
        anchor = { ...anchor, plane: ctx.planeAt(event.screenX, event.screenY), lock: key };
      }

      const delta = vec3.sub(event.world, anchor.corner);
      // The plane already accounts for an axis lock: locking Z makes it vertical, with u
      // along the locked axis, so both extents come straight from the plane basis.
      const u = vec3.dot(delta, anchor.plane.u);
      const v = vec3.dot(delta, anchor.plane.v);
      extents = { u, v };

      const corners = cornersFrom(anchor.corner, anchor.plane, u, v);
      ctx.preview({
        segments: [
          { a: corners[0], b: corners[1], color: PREVIEW.line },
          { a: corners[1], b: corners[2], color: PREVIEW.line },
          { a: corners[2], b: corners[3], color: PREVIEW.line },
          { a: corners[3], b: corners[0], color: PREVIEW.line },
        ],
        polygons: [{ points: corners, color: PREVIEW.face, opacity: 0.25 }],
        points: [{ position: anchor.corner, color: PREVIEW.point }],
      });
    },

    commitNumbers(values, ctx) {
      if (!anchor) return;
      const u = values[0];
      const v = values.length > 1 ? values[1] : values[0];
      // Direction keeps the sign the user was dragging in.
      const signU = extents.u < 0 ? -1 : 1;
      const signV = extents.v < 0 ? -1 : 1;
      commit(u * signU, v * signV, ctx);
    },

    cancel(ctx) {
      anchor = null;
      extents = { u: 0, v: 0 };
      ctx.preview(CLEAR);
    },

    readout(ctx) {
      if (!anchor) return null;
      const suffix = unitSuffix(ctx.settings.unit);
      return `${formatLength(Math.abs(extents.u), ctx.settings.unit)} × ${formatLength(
        Math.abs(extents.v),
        ctx.settings.unit,
      )} ${suffix}`;
    },

    isActive: () => anchor !== null,
    axisAnchor: () => anchor?.corner ?? null,
  };
}
