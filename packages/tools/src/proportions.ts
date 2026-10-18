import { EPS } from "@gabarito/geometry";

/** A hint only: dimensions remain exactly where the user placed them. */
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
    Math.abs(ratio - integer) > 0.02
  )
    return "";
  return integer === 1
    ? "Square · 1:1"
    : a > b
      ? `${integer}:1`
      : `1:${integer}`;
}
