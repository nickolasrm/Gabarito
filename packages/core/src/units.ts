import type { UnitId } from "./types";

export interface UnitDef {
  id: UnitId;
  label: string;
  suffix: string;
  /** How many millimetres one unit is. */
  mmPerUnit: number;
  /** Decimal places used when formatting a value in this unit. */
  decimals: number;
}

export const UNITS: Record<UnitId, UnitDef> = {
  mm: { id: "mm", label: "Millimeters", suffix: "mm", mmPerUnit: 1, decimals: 2 },
  cm: { id: "cm", label: "Centimeters", suffix: "cm", mmPerUnit: 10, decimals: 3 },
  m: { id: "m", label: "Meters", suffix: "m", mmPerUnit: 1000, decimals: 4 },
  km: { id: "km", label: "Kilometers", suffix: "km", mmPerUnit: 1_000_000, decimals: 6 },
  in: { id: "in", label: "Inches", suffix: "in", mmPerUnit: 25.4, decimals: 3 },
  ft: { id: "ft", label: "Feet", suffix: "ft", mmPerUnit: 304.8, decimals: 4 },
  yd: { id: "yd", label: "Yards", suffix: "yd", mmPerUnit: 914.4, decimals: 4 },
};

export const UNIT_IDS: UnitId[] = ["mm", "cm", "m", "km", "in", "ft", "yd"];

/** Suffixes accepted in typed input, so `5m` works even with millimetres selected. */
const SUFFIX_TO_UNIT: Record<string, UnitId> = {
  mm: "mm",
  millimeter: "mm",
  millimeters: "mm",
  millimetre: "mm",
  millimetres: "mm",
  cm: "cm",
  centimeter: "cm",
  centimeters: "cm",
  m: "m",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  km: "km",
  in: "in",
  inch: "in",
  inches: "in",
  '"': "in",
  ft: "ft",
  foot: "ft",
  feet: "ft",
  "'": "ft",
  yd: "yd",
  yard: "yd",
  yards: "yd",
};

const NUMBER_WITH_OPTIONAL_UNIT = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*([a-zA-Z"']*)$/;

/**
 * Parse user-typed length text into millimetres.
 * The decimal separator is `.` only, because `,` separates values in typed input.
 * Returns null for anything malformed, so callers can keep the buffer visible.
 */
export function parseLength(text: string, unit: UnitId): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const match = NUMBER_WITH_OPTIONAL_UNIT.exec(trimmed);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2].toLowerCase();
  if (suffix === "") return value * UNITS[unit].mmPerUnit;
  const resolved = SUFFIX_TO_UNIT[suffix];
  if (!resolved) return null;
  return value * UNITS[resolved].mmPerUnit;
}

/** Parse typed angle text into radians. Bare numbers are degrees. */
export function parseAngle(text: string): number | null {
  const trimmed = text.trim().replace(/°$/, "").replace(/deg$/i, "");
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) return null;
  if (/rad$/i.test(trimmed)) return Number.parseFloat(trimmed.replace(/rad$/i, ""));
  return (value * Math.PI) / 180;
}

function trimNumber(value: number, decimals: number): string {
  // Normalise -0 so readouts never show "-0".
  const normalised = value === 0 ? 0 : value;
  const fixed = normalised.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

/** Format millimetres in the given unit. Returns the number only; the UI adds the suffix. */
export function formatLength(mm: number, unit: UnitId): string {
  const def = UNITS[unit];
  return trimNumber(mm / def.mmPerUnit, def.decimals);
}

export function formatLengthWithUnit(mm: number, unit: UnitId): string {
  return `${formatLength(mm, unit)} ${UNITS[unit].suffix}`;
}

/** Format a squared length (mm²) in the square of the given unit. */
export function formatArea(mm2: number, unit: UnitId): string {
  const def = UNITS[unit];
  const value = mm2 / (def.mmPerUnit * def.mmPerUnit);
  return `${trimNumber(value, def.decimals)} ${def.suffix}²`;
}

/** Angles are always shown in degrees. */
export function formatAngle(radians: number): string {
  return `${trimNumber((radians * 180) / Math.PI, 2)}°`;
}

export function unitSuffix(unit: UnitId): string {
  return UNITS[unit].suffix;
}
