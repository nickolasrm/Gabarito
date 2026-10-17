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

  it("returns the outer rectangle when there is no overlap", () => {
    const outer = face(0, 0, 1000, 0, 1000);
    expect(rect.subtract(outer, face(0, 2000, 3000, 0, 1000))).toEqual([outer]);
  });

  it("returns the outer rectangle when the inner one is in another plane", () => {
    const outer = face(0, 0, 1000, 0, 1000);
    expect(rect.subtract(outer, face(400, 100, 200, 100, 200))).toEqual([outer]);
  });

  it("splits into four when the inner rectangle is contained", () => {
    const outer = face(0, 0, 1000, 0, 1000);
    const pieces = rect.subtract(outer, face(0, 400, 600, 400, 600));
    expect(pieces).toHaveLength(4);
    // The area is conserved: the ring equals the outer minus the inner.
    const total = pieces.reduce((sum, piece) => sum + rect.area(piece), 0);
    expect(total).toBeCloseTo(1000 * 1000 - 200 * 200, 6);
  });

  it("splits into three when the inner rectangle touches an edge", () => {
    const outer = face(0, 0, 1000, 0, 1000);
    const pieces = rect.subtract(outer, face(0, 400, 600, 400, 1000));
    expect(pieces).toHaveLength(3);
    const total = pieces.reduce((sum, piece) => sum + rect.area(piece), 0);
    expect(total).toBeCloseTo(1000 * 1000 - 200 * 600, 6);
  });

  it("splits into one when a corner is bitten out", () => {
    const outer = face(0, 0, 1000, 0, 1000);
    const pieces = rect.subtract(outer, face(0, 0, 400, 0, 400));
    expect(pieces).toHaveLength(2);
    const total = pieces.reduce((sum, piece) => sum + rect.area(piece), 0);
    expect(total).toBeCloseTo(1000 * 1000 - 400 * 400, 6);
  });

  it("removes the face when the inner rectangle covers it", () => {
    const outer = face(0, 0, 1000, 0, 1000);
    expect(rect.subtract(outer, face(0, -100, 1100, -100, 1100))).toEqual([]);
    expect(rect.subtract(outer, outer)).toEqual([]);
  });

  it("clips an oversized tool to the face", () => {
    const outer = face(0, 0, 1000, 0, 1000);
    const pieces = rect.subtract(outer, face(0, 800, 3000, 0, 1000));
    expect(pieces).toHaveLength(1);
    expect(rect.area(pieces[0])).toBeCloseTo(800 * 1000, 6);
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
