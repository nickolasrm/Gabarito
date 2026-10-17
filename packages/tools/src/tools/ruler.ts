import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { buildGuide, formatLength, unitSuffix } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { Tool, ToolContext } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };
const GUIDE_EXTENT = 1_000_000;

/**
 * Ruler (tape measure): two clicks create an infinite construction line through them.
 * With an axis locked the guide follows that axis, and a typed distance offsets it
 * perpendicularly — the "guide 300 mm from this edge" workflow (decision 0014).
 */
export function createRulerTool(): Tool {
  let start: Vec3 | null = null;
  let last: Vec3 | null = null;

  const place = (ctx: ToolContext, end: Vec3, offset: number): void => {
    if (!start) return;
    const lock = ctx.axisLock;
    const delta = vec3.sub(end, start);
    const direction = lock ? lock.direction : vec3.normalize(delta);
    if (vec3.isZero(direction)) return;

    let origin = start;
    if (Math.abs(offset) > 1e-6) {
      const perpendicular = vec3.sub(delta, vec3.scale(direction, vec3.dot(delta, direction)));
      if (vec3.isZero(perpendicular)) return;
      origin = vec3.add(start, vec3.scale(vec3.normalize(perpendicular), offset));
    }

    const built = buildGuide(ctx.doc, origin, direction);
    if (built.entities.length > 0) ctx.dispatch({ type: "addEntities", entities: built.entities });
    start = null;
    last = null;
    ctx.preview(CLEAR);
  };

  const previewGuide = (ctx: ToolContext, end: Vec3): void => {
    if (!start) return;
    const lock = ctx.axisLock;
    const direction = lock ? lock.direction : vec3.normalize(vec3.sub(end, start));
    if (vec3.isZero(direction)) return;
    const a = vec3.sub(start, vec3.scale(direction, GUIDE_EXTENT));
    const b = vec3.add(start, vec3.scale(direction, GUIDE_EXTENT));
    ctx.preview({
      segments: [
        { a, b, color: PREVIEW.guide },
        { a: start, b: end, color: PREVIEW.line },
      ],
      polygons: [],
      points: [{ position: start, color: PREVIEW.point }],
    });
  };

  return {
    id: "ruler",
    label: "Ruler",
    shortcut: "T",
    hint: "Click two points to create a guide. Arrow keys pin the direction; type a distance and press Enter to offset the guide.",
    numbers: { kind: "length", max: 1, example: "300", labels: ["offset"] },

    pointerDown(event, ctx) {
      last = event.world;
      if (!start) {
        start = event.world;
        return;
      }
      place(ctx, event.world, 0);
    },

    pointerMove(event, ctx) {
      last = event.world;
      previewGuide(ctx, event.world);
    },

    commitNumbers(values, ctx) {
      if (!start || !last) return;
      place(ctx, last, values[0]);
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
      return `${formatLength(vec3.len(delta), ctx.settings.unit)} ${suffix}  (${formatLength(
        delta.x,
        ctx.settings.unit,
      )}, ${formatLength(delta.y, ctx.settings.unit)}, ${formatLength(delta.z, ctx.settings.unit)})`;
    },

    isActive: () => start !== null,
    axisAnchor: () => start,
  };
}
