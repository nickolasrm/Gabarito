import { EPS, add, mul, project } from "@gabarito/geometry";
import type { Vec3, Plane } from "@gabarito/geometry";
import type { ToolView } from "./types";

/** Report only exact proportions; proximity snapping happens before preview and commit. */
export function rectangleRatio(width: number, height: number): string {
  const a = Math.abs(width),
    b = Math.abs(height),
    short = Math.min(a, b);
  if (short < EPS) return "";
  const ratio = Math.max(a, b) / short,
    integer = Math.round(ratio);
  if (
    !Number.isSafeInteger(integer) ||
    integer < 1 ||
    Math.abs(ratio - integer) > 1e-6
  )
    return "";
  return integer === 1
    ? "Square · 1:1"
    : a > b
      ? `${integer}:1`
      : `1:${integer}`;
}
export function snapProportion(
  start: Vec3,
  end: Vec3,
  frame: Plane,
  view: ToolView,
  tolerance = 8,
): Vec3 | null {
  const [x, y] = project(end, { ...frame, origin: start });
  const at = (a: number, b: number) =>
    add(start, add(mul(frame.u, a), mul(frame.v, b)));
  const screenDistance = (a: Vec3, b: Vec3) => {
    const p = view.project(a),
      q = view.project(b);
    return p.visible && q.visible ? Math.hypot(p.x - q.x, p.y - q.y) : Infinity;
  };
  if (
    Math.min(screenDistance(start, at(x, 0)), screenDistance(start, at(0, y))) <
    tolerance
  )
    return null;
  const integer = Math.round(
    Math.max(Math.abs(x), Math.abs(y)) / Math.min(Math.abs(x), Math.abs(y)),
  );
  if (!Number.isSafeInteger(integer) || integer < 1) return null;
  const ratio = Math.abs(x) >= Math.abs(y) ? integer : 1 / integer;
  const candidates = [
    at(Math.sign(x) * Math.abs(y) * ratio, y),
    at(x, (Math.sign(y) * Math.abs(x)) / ratio),
  ]
    .map((point) => ({ point, pixels: screenDistance(point, end) }))
    .filter((c) => c.pixels <= tolerance)
    .sort((a, b) => a.pixels - b.pixels);
  return candidates[0]?.point ?? null;
}
