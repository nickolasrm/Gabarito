import { poly as polyOps, vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { buildExtrusion, facePositions, formatLength, unitSuffix } from "@gabarito/core";
import type { EntityId } from "@gabarito/core";
import { axisPlaneNormal } from "../planes";
import { PREVIEW } from "../style";
import type { Tool, ToolContext, ToolPointerEvent } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };

/**
 * Push/Pull: click a face, then drag along its normal — or type a distance.
 * Extrusion only; no boolean operations yet (decision 0011).
 *
 * The drag distance cannot come from the point on the face plane: any point on that
 * plane gives a zero distance along the normal, which is why this tool raycasts the
 * pointer onto its own plane, one that contains the pull direction and faces the camera.
 */
export function createPushPullTool(): Tool {
  let faceId: EntityId | null = null;
  let origin: Vec3 | null = null;
  let normal: Vec3 | null = null;
  let distance = 0;
  let inverted = false;

  const clear = (ctx: ToolContext): void => {
    faceId = null;
    origin = null;
    normal = null;
    distance = 0;
    inverted = false;
    ctx.preview(CLEAR);
  };

  const pullAxis = (ctx: ToolContext): Vec3 =>
    ctx.axisLock ? ctx.axisLock.direction : (normal ?? { x: 0, y: 0, z: 1 });

  /** The pointer position on a camera-facing plane that contains the pull direction. */
  const pullPoint = (event: ToolPointerEvent, ctx: ToolContext, anchor: Vec3, axis: Vec3): Vec3 => {
    const normal = axisPlaneNormal(axis, ctx.viewDirection());
    return ctx.worldOnPlane(event.screenX, event.screenY, { origin: anchor, normal }) ?? event.raw;
  };

  const commit = (value: number, ctx: ToolContext): void => {
    if (!faceId || Math.abs(value) < 1e-6) {
      clear(ctx);
      return;
    }
    const built = buildExtrusion(ctx.doc, faceId, value, pullAxis(ctx));
    if (built.entities.length > 0) ctx.dispatch({ type: "addEntities", entities: built.entities });
    clear(ctx);
  };

  return {
    id: "pushpull",
    label: "Push/Pull",
    shortcut: "P",
    cursor: "ns-resize",
    lockMode: "plane",
    hint: "Click a face, drag along its normal, click again. Type a distance and press Enter. `↓` inverts.",
    numbers: { kind: "length", max: 1, example: "50", labels: ["distance"] },

    pointerDown(event, ctx) {
      if (faceId) {
        commit(distance, ctx);
        return;
      }
      const hit = ctx.pick(event.screenX, event.screenY);
      if (!hit || hit.kind !== "face") return;
      const face = ctx.doc.entities[hit.entityId];
      if (!face || face.kind !== "face") return;
      const positions = facePositions(ctx.doc, face);
      const faceNormal = polyOps.normal(positions);
      if (!faceNormal) return;
      faceId = face.id;
      origin = hit.point;
      normal = faceNormal;
      distance = 0;
    },

    pointerMove(event, ctx) {
      if (!faceId || !normal || !origin) return;
      const axis = pullAxis(ctx);
      const world = pullPoint(event, ctx, origin, axis);
      distance = (inverted ? -1 : 1) * vec3.dot(vec3.sub(world, origin), axis);

      const face = ctx.doc.entities[faceId];
      if (!face || face.kind !== "face") return;
      const positions = facePositions(ctx.doc, face);
      const offset = vec3.scale(normal, distance);
      const top = positions.map((point) => vec3.add(point, offset));
      const segments: Array<{ a: Vec3; b: Vec3; color?: number }> = [];
      for (let index = 0; index < positions.length; index += 1) {
        const next = (index + 1) % positions.length;
        segments.push({ a: top[index], b: top[next], color: PREVIEW.line });
        segments.push({ a: positions[index], b: top[index], color: PREVIEW.line });
      }
      ctx.preview({
        segments,
        polygons: [{ points: top, color: PREVIEW.face, opacity: 0.3 }],
        points: [],
      });
    },

    commitNumbers(values, ctx) {
      commit(inverted ? -values[0] : values[0], ctx);
    },

    invertDirection(ctx) {
      inverted = !inverted;
      ctx.preview(CLEAR);
    },

    cancel: clear,

    readout(ctx) {
      if (!faceId) return null;
      return `${formatLength(distance, ctx.settings.unit)} ${unitSuffix(ctx.settings.unit)}`;
    },

    isActive: () => faceId !== null,
    axisAnchor: () => origin,
  };
}
