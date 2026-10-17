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
  let cursor: Vec3 | null = null;
  let lastRaw: Vec3 | null = null;

  /**
   * `raw` is the pointer before inference. With an axis locked the resolved point sits on
   * the axis, which leaves no perpendicular to offset along, so the offset is measured
   * against the raw pointer instead.
   */
  const place = (ctx: ToolContext, end: Vec3, offset: number, raw: Vec3 | null): void => {
    if (!start) return;
    const direction = ctx.axisLock ? ctx.axisLock.direction : vec3.normalize(vec3.sub(end, start));
    if (vec3.isZero(direction)) return;

    let origin = start;
    if (Math.abs(offset) > 1e-6) {
      const spread = vec3.sub(raw ?? end, start);
      const perpendicular = vec3.sub(spread, vec3.scale(direction, vec3.dot(spread, direction)));
      if (vec3.isZero(perpendicular)) return;
      origin = vec3.add(start, vec3.scale(vec3.normalize(perpendicular), offset));
    }

    const built = buildGuide(ctx.doc, origin, direction);
    if (built.entities.length > 0) ctx.dispatch({ type: "addEntities", entities: built.entities });
    start = null;
    cursor = null;
    lastRaw = null;
    ctx.preview(CLEAR);
  };

  const previewGuide = (ctx: ToolContext, end: Vec3): void => {
    if (!start) return;
    const direction = ctx.axisLock ? ctx.axisLock.direction : vec3.normalize(vec3.sub(end, start));
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
    cursor: "crosshair",
    lockMode: "axis",
    hint: "Click two points to create a guide. Arrow keys pin the direction; type a distance and press Enter to offset the guide.",
    numbers: { kind: "length", max: 1, example: "300", labels: ["offset"] },

    pointerDown(event, ctx) {
      cursor = event.world;
      lastRaw = event.raw;
      if (!start) {
        start = event.world;
        return;
      }
      place(ctx, event.world, 0, event.raw);
    },

    pointerMove(event, ctx) {
      cursor = event.world;
      lastRaw = event.raw;
      previewGuide(ctx, event.world);
    },

    commitNumbers(values, ctx) {
      if (!start || !cursor) return;
      place(ctx, cursor, values[0], lastRaw);
    },

    cancel(ctx) {
      start = null;
      cursor = null;
      lastRaw = null;
      ctx.preview(CLEAR);
    },

    readout(ctx) {
      if (!start || !cursor) return null;
      const suffix = unitSuffix(ctx.settings.unit);
      const delta = vec3.sub(cursor, start);
      return `${formatLength(vec3.len(delta), ctx.settings.unit)} ${suffix}  (${formatLength(
        delta.x,
        ctx.settings.unit,
      )}, ${formatLength(delta.y, ctx.settings.unit)}, ${formatLength(delta.z, ctx.settings.unit)})`;
    },

    isActive: () => start !== null,
    axisAnchor: () => start,
  };
}
