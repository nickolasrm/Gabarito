import { describe, expect, it } from "vitest";
import { rect } from "./rect";
import type { PlaneRect } from "./rect";
import { vec3 } from "./vec3";

const face = (value: number, uMin: number, uMax: number, vMin: number, vMax: number): PlaneRect => ({
  axis: "z",
  value,
  uMin,
  uMax,
  vMin,
  vMax,
});

describe("rect", () => {
  it("reads a rectangle from a polygon", () => {
    const points = [vec3.of(0, 0, 500), vec3.of(1000, 0, 500), vec3.of(1000, 600, 500), vec3.of(0, 600, 500)];
    expect(rect.fromPolygon(points)).toEqual({ axis: "z", value: 500, uMin: 0, uMax: 1000, vMin: 0, vMax: 600 });
  });

  it("refuses a polygon that is not a flat rectangle", () => {
    expect(rect.fromPolygon([vec3.of(0, 0, 0), vec3.of(1000, 0, 0), vec3.of(0, 600, 0)])).toBeNull();
    // A trapezium: its corners are not the corners of the rectangle that bounds it.
    expect(
      rect.fromPolygon([vec3.of(0, 0, 0), vec3.of(1000, 0, 0), vec3.of(600, 600, 0), vec3.of(0, 600, 0)]),
    ).toBeNull();
    // A square whose corners are in a shuffled order is still a rectangle.
    expect(
      rect.fromPolygon([vec3.of(0, 0, 0), vec3.of(1000, 0, 0), vec3.of(1000, 600, 0), vec3.of(0, 600, 0)]),
    ).not.toBeNull();
  });

  it("winds corners outwards from a centre", () => {
    const centre = vec3.of(500, 500, 0);
    const outward = rect.cornersOutward({ ...face(0, 0, 1000, 0, 1000), value: 0 }, centre);
    expect(rect.corners({ ...face(0, 0, 1000, 0, 1000), value: 0 })).toHaveLength(4);
    expect(outward).toHaveLength(4);
  });

  it("intersects only in the same plane", () => {
    expect(rect.intersect(face(0, 0, 100, 0, 100), face(0, 50, 150, 50, 150))).toEqual({
      axis: "z",
      value: 0,
      uMin: 50,
      uMax: 100,
      vMin: 50,
      vMax: 100,
    });
    expect(rect.intersect(face(0, 0, 100, 0, 100), face(10, 0, 100, 0, 100))).toBeNull();
  });
});
