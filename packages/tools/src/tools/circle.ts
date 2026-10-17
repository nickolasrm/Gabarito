import { vec3 } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import { buildPolygonFace, formatLength, unitSuffix } from "@gabarito/core";
import { PREVIEW } from "../style";
import type { DrawingPlane, Tool, ToolContext } from "../types";

const CLEAR = { segments: [], polygons: [], points: [] };

/**
 * Circle: click the centre, then a point on the circumference. Tessellated at creation
 * time into straight edges (decision 0013); the segment count is a setting.
 */
export function createCircleTool(): Tool {
  let anchor: { centre: Vec3; plane: DrawingPlane } | null = null;
  let radius = 0;

  const positions = (plane: DrawingPlane, centre: Vec3, r: number, segments: number): Vec3[] => {
    const points: Vec3[] = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const offset = vec3.add(
        vec3.scale(plane.u, Math.cos(angle) * r),
        vec3.scale(plane.v, Math.sin(angle) * r),
      );
      points.push(vec3.add(centre, offset));
    }
    return points;
  };

  const commit = (r: number, ctx: ToolContext): void => {
    if (!anchor || Math.abs(r) < 1e-6) return;
    const segments = Math.max(3, Math.round(ctx.settings.circleSegments));
    const built = buildPolygonFace(ctx.doc, positions(anchor.plane, anchor.centre, r, segments));
    if (built.entities.length > 0) ctx.dispatch({ type: "addEntities", entities: built.entities });
    anchor = null;
    radius = 0;
    ctx.preview(CLEAR);
  };

  return {
    id: "circle",
    label: "Circle",
    shortcut: "C",
    hint: "Click the centre, then a point on the circle. Type a radius and press Enter.",
    numbers: { kind: "length", max: 1, example: "10", labels: ["radius"] },

    pointerDown(event, ctx) {
      if (!anchor) {
        anchor = { centre: event.world, plane: ctx.planeAt(event.screenX, event.screenY) };
        return;
      }
      commit(radius, ctx);
    },

    pointerMove(event, ctx) {
      if (!anchor) return;
      radius = vec3.dist(anchor.centre, event.world);
      const segments = Math.max(3, Math.round(ctx.settings.circleSegments));
      const points = positions(anchor.plane, anchor.centre, radius, segments);
      const outline: Array<{ a: Vec3; b: Vec3; color?: number }> = [];
      for (let index = 0; index < points.length; index += 1) {
        outline.push({
          a: points[index],
          b: points[(index + 1) % points.length],
          color: PREVIEW.line,
        });
      }
      outline.push({ a: anchor.centre, b: event.world, color: PREVIEW.guide });
      ctx.preview({
        segments: outline,
        polygons: [{ points, color: PREVIEW.face, opacity: 0.25 }],
        points: [{ position: anchor.centre, color: PREVIEW.point }],
      });
    },

    commitNumbers(values, ctx) {
      commit(values[0], ctx);
    },

    cancel(ctx) {
      anchor = null;
      radius = 0;
      ctx.preview(CLEAR);
    },

    readout(ctx) {
      if (!anchor) return null;
      return `r ${formatLength(radius, ctx.settings.unit)} ${unitSuffix(ctx.settings.unit)}`;
    },

    isActive: () => anchor !== null,
    axisAnchor: () => anchor?.centre ?? null,
  };
}
