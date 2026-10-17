import { poly as polyOps, vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { buildExtrusion, facePositions, formatLength, unitSuffix } from "@gabarito/core";
import type { EntityId } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { Tool, ToolContext } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };

/**
 * Push/Pull: click a face, then click again after moving — or type a distance.
 * Extrusion only; no boolean operations yet (decision 0011, interim).
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

  const distanceTo = (world: Vec3, ctx: ToolContext): number => {
    if (!origin) return 0;
    const sign = inverted ? -1 : 1;
    if (ctx.axisLock) return sign * vec3.dot(vec3.sub(world, origin), ctx.axisLock.direction);
    if (!normal) return 0;
    return sign * vec3.dot(vec3.sub(world, origin), normal);
  };

  const commit = (value: number, ctx: ToolContext): void => {
    if (!faceId || Math.abs(value) < 1e-6) {
      clear(ctx);
      return;
    }
    const built = buildExtrusion(ctx.doc, faceId, value);
    if (built.entities.length > 0) ctx.dispatch({ type: "addEntities", entities: built.entities });
    clear(ctx);
  };

  return {
    id: "pushpull",
    label: "Push/Pull",
    shortcut: "P",
    hint: "Click a face, move along its normal, click again. Type a distance and press Enter. `↓` inverts.",
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
      distance = distanceTo(event.world, ctx);
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
