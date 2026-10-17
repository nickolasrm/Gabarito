import { describe, it, expect } from "vitest";
import {
  AXES,
  EPS,
  type Plane,
  type Segment,
  angle,
  bounds,
  extrude,
  plane,
  poly,
  ray,
  segment,
  transform,
  triangulate,
  vec3,
} from "./index";

describe("vec3", () => {
  it("constructs and does basic arithmetic", () => {
    const a = vec3.of(1, 2, 3);
    expect(a).toEqual({ x: 1, y: 2, z: 3 });
    expect(vec3.add(a, vec3.of(1, 1, 1))).toEqual({ x: 2, y: 3, z: 4 });
    expect(vec3.sub(a, vec3.of(1, 1, 1))).toEqual({ x: 0, y: 1, z: 2 });
    expect(vec3.scale(a, 2)).toEqual({ x: 2, y: 4, z: 6 });
    expect(vec3.mul(a, vec3.of(2, 0, 1))).toEqual({ x: 2, y: 0, z: 3 });
    expect(vec3.dot(a, vec3.of(1, 0, 0))).toBe(1);
    expect(vec3.cross(vec3.of(1, 0, 0), vec3.of(0, 1, 0))).toEqual({ x: 0, y: 0, z: 1 });
    expect(vec3.len(a)).toBeCloseTo(Math.sqrt(14));
    expect(vec3.neg(a)).toEqual({ x: -1, y: -2, z: -3 });
  });

  it("normalizes and handles the zero vector", () => {
    expect(vec3.normalize(vec3.of(0, 0, 0))).toEqual({ x: 0, y: 0, z: 0 });
    const n = vec3.normalize(vec3.of(0, 3, 4));
    expect(vec3.len(n)).toBeCloseTo(1);
    expect(n.y).toBeCloseTo(0.6);
    expect(n.z).toBeCloseTo(0.8);
    expect(vec3.isZero(vec3.of(0, 0, 0))).toBe(true);
    expect(vec3.isZero(vec3.of(1e-3, 0, 0))).toBe(false);
  });

  it("converts to and from arrays and compares", () => {
    expect(vec3.toArray(vec3.fromArray([1, 2, 3, 9], 1))).toEqual([2, 3, 9]);
    expect(vec3.equals(vec3.of(1, 2, 3), vec3.of(1, 2, 3))).toBe(true);
    expect(vec3.equals(vec3.of(1, 2, 3), vec3.of(1, 2, 3.5))).toBe(false);
    expect(vec3.lerp(vec3.of(0, 0, 0), vec3.of(2, 4, 6), 0.5)).toEqual({ x: 1, y: 2, z: 3 });
    expect(vec3.dist(vec3.of(0, 0, 0), vec3.of(0, 3, 4))).toBeCloseTo(5);
  });

  it("exposes the kernel tolerances and axes", () => {
    expect(EPS.LENGTH).toBe(1e-6);
    expect(EPS.ANGLE).toBe(1e-6);
    expect(EPS.MERGE).toBe(1e-4);
    expect(EPS.PARALLEL).toBe(1e-6);
    expect(AXES.ORIGIN).toEqual({ x: 0, y: 0, z: 0 });
    expect(AXES.Z).toEqual({ x: 0, y: 0, z: 1 });
  });
});

describe("angle", () => {
  it("measures angles in radians and degrees", () => {
    expect(angle.between(vec3.of(1, 0, 0), vec3.of(0, 1, 0))).toBeCloseTo(Math.PI / 2);
    expect(angle.signedAround(AXES.Z, vec3.of(1, 0, 0), vec3.of(0, 1, 0))).toBeCloseTo(Math.PI / 2);
    expect(angle.signedAround(AXES.Z, vec3.of(0, 1, 0), vec3.of(1, 0, 0))).toBeCloseTo(-Math.PI / 2);
    expect(angle.toDegrees(Math.PI)).toBeCloseTo(180);
    expect(angle.toRadians(90)).toBeCloseTo(Math.PI / 2);
  });
});

describe("plane", () => {
  it("builds a plane from three points", () => {
    const p = plane.fromPoints(vec3.of(0, 0, 0), vec3.of(1, 0, 0), vec3.of(0, 1, 0));
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.normal).toEqual({ x: 0, y: 0, z: 1 });
    expect(plane.distanceToPoint(p, vec3.of(0, 0, 5))).toBeCloseTo(5);
    expect(plane.contains(p, vec3.of(0.5, 0.5, 0))).toBe(true);
    expect(plane.contains(p, vec3.of(0.5, 0.5, 1))).toBe(false);
    expect(plane.projectPoint(p, vec3.of(2, 3, 7))).toEqual({ x: 2, y: 3, z: 0 });
    expect(plane.flip(p).normal).toEqual({ x: 0, y: 0, z: -1 });
  });

  it("returns null for a degenerate triple", () => {
    expect(plane.fromPoints(vec3.of(0, 0, 0), vec3.of(1, 0, 0), vec3.of(2, 0, 0))).toBeNull();
    expect(plane.fromPoints(vec3.of(1, 1, 1), vec3.of(1, 1, 1), vec3.of(1, 1, 1))).toBeNull();
  });

  it("builds from point/normal and axis, throwing on zero normal", () => {
    expect(() => plane.fromPointNormal(vec3.of(0, 0, 0), vec3.of(0, 0, 0))).toThrow();
    expect(plane.fromAxis(AXES.ORIGIN, "z").normal).toEqual({ x: 0, y: 0, z: 1 });
    expect(plane.fromPointNormal(vec3.of(1, 2, 3), vec3.of(0, 0, 10)).normal).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });
  });
});

describe("segment", () => {
  it("computes length, direction, midpoint and distance", () => {
    const s: Segment = { a: vec3.of(0, 0, 0), b: vec3.of(3, 4, 0) };
    expect(segment.length(s)).toBeCloseTo(5);
    expect(segment.direction(s).x).toBeCloseTo(0.6);
    expect(segment.direction(s).y).toBeCloseTo(0.8);
    expect(segment.midpoint(s)).toEqual({ x: 1.5, y: 2, z: 0 });
    expect(segment.distanceToPoint(s, vec3.of(1.5, -2, 0))).toBeCloseTo(2.5);
    expect(segment.direction({ a: vec3.of(1, 1, 1), b: vec3.of(1, 1, 1) })).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });

  it("finds closest points between skew segments", () => {
    const a: Segment = { a: vec3.of(0, 0, 0), b: vec3.of(1, 0, 0) };
    const b: Segment = { a: vec3.of(0.5, 1, -1), b: vec3.of(0.5, 1, 1) };
    const cp = segment.closestPoints(a, b);
    expect(cp.tA).toBeCloseTo(0.5);
    expect(cp.tB).toBeCloseTo(0.5);
    expect(cp.dist).toBeCloseTo(1);
    expect(cp.onA.x).toBeCloseTo(0.5);
    expect(cp.onB.y).toBeCloseTo(1);
  });

  it("handles intersecting segments", () => {
    const a: Segment = { a: vec3.of(0, 0, 0), b: vec3.of(2, 0, 0) };
    const b: Segment = { a: vec3.of(1, -1, 0), b: vec3.of(1, 1, 0) };
    const cp = segment.closestPoints(a, b);
    expect(cp.dist).toBeCloseTo(0);
    expect(cp.onA.x).toBeCloseTo(1);
    expect(cp.onA.y).toBeCloseTo(0);
  });
});

describe("ray", () => {
  it("intersects a plane", () => {
    const r = ray.of(vec3.of(0, 0, 5), vec3.of(0, 0, -1));
    const p = plane.fromAxis(AXES.ORIGIN, "z");
    const hit = ray.intersectPlane(r, p);
    expect(hit).not.toBeNull();
    if (!hit) return;
    expect(hit.x).toBeCloseTo(0);
    expect(hit.z).toBeCloseTo(0);
    expect(ray.at(r, 5).z).toBeCloseTo(0);
  });

  it("misses a parallel plane and a behind-origin plane", () => {
    const p = plane.fromAxis(AXES.ORIGIN, "z");
    expect(ray.intersectPlane(ray.of(vec3.of(0, 0, 5), vec3.of(1, 0, 0)), p)).toBeNull();
    expect(ray.intersectPlane(ray.of(vec3.of(0, 0, 5), vec3.of(0, 0, 1)), p)).toBeNull();
  });

  it("intersects a segment within range", () => {
    const r = ray.of(vec3.of(0, 0, 0), vec3.of(1, 0, 0));
    const s: Segment = { a: vec3.of(2, -1, 0), b: vec3.of(2, 1, 0) };
    const hit = ray.intersectSegment(r, s);
    expect(hit).not.toBeNull();
    if (!hit) return;
    expect(hit.x).toBeCloseTo(2);
    expect(ray.intersectSegment(r, { a: vec3.of(-2, -1, 0), b: vec3.of(-2, 1, 0) })).toBeNull();
  });
});

describe("poly", () => {
  const square = [vec3.of(0, 0, 0), vec3.of(1, 0, 0), vec3.of(1, 1, 0), vec3.of(0, 1, 0)];

  it("computes normal and area of a unit square", () => {
    expect(poly.normal(square)).toEqual({ x: 0, y: 0, z: 1 });
    expect(poly.area(square)).toBeCloseTo(1);
    expect(poly.perimeter(square)).toBeCloseTo(4);
    expect(poly.centroid(square).x).toBeCloseTo(0.5);
    expect(poly.centroid(square).y).toBeCloseTo(0.5);
    expect(poly.isPlanar(square)).toBe(true);
    expect(poly.isPlanar([square[0], square[1], square[2], vec3.of(0, 1, 5)])).toBe(false);
    expect(poly.normal([vec3.of(0, 0, 0), vec3.of(1, 0, 0)])).toBeNull();
  });

  it("dedupes consecutive duplicates and orients", () => {
    const dup = [
      vec3.of(0, 0, 0),
      vec3.of(0, 0, 0),
      vec3.of(1, 0, 0),
      vec3.of(1, 1, 0),
      vec3.of(0, 0, 0),
    ];
    expect(poly.dedupe(dup)).toHaveLength(3);
    const cw = [vec3.of(0, 0, 0), vec3.of(0, 1, 0), vec3.of(1, 1, 0), vec3.of(1, 0, 0)];
    expect(poly.signedArea2D(cw, AXES.Z)).toBeLessThan(0);
    const ccw = poly.orient(cw, AXES.Z);
    expect(poly.signedArea2D(ccw, AXES.Z)).toBeGreaterThan(0);
    expect(poly.orient(cw, AXES.Z)).not.toBe(cw);
    expect(cw).toHaveLength(4);
  });

  it("tests containment in a concave L", () => {
    const L = [
      vec3.of(0, 0, 0),
      vec3.of(2, 0, 0),
      vec3.of(2, 1, 0),
      vec3.of(1, 1, 0),
      vec3.of(1, 2, 0),
      vec3.of(0, 2, 0),
    ];
    expect(poly.containsPoint(L, vec3.of(0.5, 0.5, 0))).toBe(true);
    expect(poly.containsPoint(L, vec3.of(0.5, 1.5, 0))).toBe(true);
    expect(poly.containsPoint(L, vec3.of(1.5, 1.5, 0))).toBe(false);
    expect(poly.containsPoint(L, vec3.of(3, 3, 0))).toBe(false);
    expect(poly.containsPoint(L, vec3.of(1.5, 0.5, 0))).toBe(true);
    expect(poly.area(L)).toBeCloseTo(3);
  });
});

describe("triangulate", () => {
  const L = [
    vec3.of(0, 0, 0),
    vec3.of(2, 0, 0),
    vec3.of(2, 1, 0),
    vec3.of(1, 1, 0),
    vec3.of(1, 2, 0),
    vec3.of(0, 2, 0),
  ];

  it("triangulates a concave polygon into n-2 triangles covering every vertex", () => {
    const tris = triangulate.polygon(L);
    expect(tris.length).toBe(3 * (L.length - 2));
    const used = new Set(tris);
    for (let i = 0; i < L.length; i++) expect(used.has(i)).toBe(true);
    for (const i of tris) {
      expect(Number.isInteger(i)).toBe(true);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(L.length);
    }
    let sum = 0;
    for (let i = 0; i < tris.length; i += 3) {
      const a = L[tris[i]];
      const b = L[tris[i + 1]];
      const c = L[tris[i + 2]];
      sum += vec3.len(vec3.cross(vec3.sub(b, a), vec3.sub(c, a))) / 2;
    }
    expect(sum).toBeCloseTo(poly.area(L));
  });

  it("bails out on degenerate input", () => {
    expect(triangulate.polygon([vec3.of(0, 0, 0), vec3.of(1, 0, 0)])).toEqual([]);
    expect(
      triangulate.polygon([vec3.of(0, 0, 0), vec3.of(1, 0, 0), vec3.of(2, 0, 0)]),
    ).toEqual([]);
    expect(triangulate.fan([vec3.of(0, 0, 0), vec3.of(1, 0, 0), vec3.of(1, 1, 0)])).toEqual([
      0, 1, 2,
    ]);
  });
});

describe("extrude", () => {
  const square = [vec3.of(0, 0, 0), vec3.of(1, 0, 0), vec3.of(1, 1, 0), vec3.of(0, 1, 0)];

  it("builds a closed prism whose index list references every vertex", () => {
    const m = extrude.prism(square, vec3.of(0, 0, 2));
    expect(m.positions.length).toBe(2 * square.length * 3);
    expect(m.positions.length / 3).toBe(8);
    expect(m.indices.length).toBe(36);
    expect(new Set(m.indices).size).toBe(8);
    for (const i of m.indices) {
      expect(Number.isInteger(i)).toBe(true);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(8);
    }
  });

  it("caps face outward and walls face outward", () => {
    const m = extrude.prism(square, vec3.of(0, 0, 2));
    const point = (i: number) =>
      vec3.of(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]);
    const triNormal = (i0: number, i1: number, i2: number) =>
      vec3.normalize(vec3.cross(vec3.sub(point(i1), point(i0)), vec3.sub(point(i2), point(i0))));
    expect(triNormal(m.indices[0], m.indices[1], m.indices[2]).z).toBeCloseTo(-1);
    const last = m.indices.length;
    expect(triNormal(m.indices[last - 3], m.indices[last - 2], m.indices[last - 1]).z).toBeCloseTo(1);
    // First wall triangle: edge 0->1 along +x, outward normal is -y.
    expect(triNormal(m.indices[6], m.indices[7], m.indices[8]).y).toBeCloseTo(-1);
  });

  it("builds walls and a cap separately", () => {
    const w = extrude.walls(square, vec3.of(0, 0, 2));
    expect(w.positions.length).toBe(8 * 3);
    expect(w.indices.length).toBe(6 * 4);
    const c = extrude.cap(square, AXES.Z);
    expect(c.positions.length).toBe(4 * 3);
    expect(c.indices.length).toBe(2 * 3);
  });
});

describe("transform", () => {
  it("rotates a point around an axis (Z up)", () => {
    const r = transform.rotatePointAroundAxis(
      vec3.of(1, 0, 0),
      AXES.ORIGIN,
      AXES.Z,
      Math.PI / 2,
    );
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
    expect(r.z).toBeCloseTo(0);
    const p = transform.rotatePointAroundAxis(
      vec3.of(2, 0, 5),
      vec3.of(0, 0, 5),
      vec3.of(0, 0, 1),
      Math.PI,
    );
    expect(p.x).toBeCloseTo(-2);
    expect(p.z).toBeCloseTo(5);
    expect(transform.rotatePointAroundAxis(vec3.of(1, 1, 1), AXES.ORIGIN, AXES.Z, 0)).toEqual({
      x: 1,
      y: 1,
      z: 1,
    });
    expect(
      transform.rotatePointsAroundAxis([vec3.of(1, 0, 0)], AXES.ORIGIN, AXES.Z, Math.PI / 2)[0].y,
    ).toBeCloseTo(1);
  });

  it("translates and mirrors without mutating inputs", () => {
    expect(transform.translate(vec3.of(1, 2, 3), vec3.of(-1, 0, 1))).toEqual({ x: 0, y: 2, z: 4 });
    expect(transform.translatePoints([vec3.of(0, 0, 0)], vec3.of(1, 1, 1))[0]).toEqual({
      x: 1,
      y: 1,
      z: 1,
    });
    const p: Plane = plane.fromAxis(AXES.ORIGIN, "z");
    expect(transform.mirrorPoint(vec3.of(2, 3, 7), p)).toEqual({ x: 2, y: 3, z: -7 });
  });
});

describe("bounds", () => {
  it("builds a box from points and expands without mutating", () => {
    const b = bounds.fromPoints([vec3.of(0, 0, 0), vec3.of(1, 2, 3)]);
    expect(b).not.toBeNull();
    if (!b) return;
    expect(b.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(b.max).toEqual({ x: 1, y: 2, z: 3 });
    expect(bounds.center(b)).toEqual({ x: 0.5, y: 1, z: 1.5 });
    expect(bounds.size(b)).toEqual({ x: 1, y: 2, z: 3 });
    expect(bounds.diagonal(b)).toBeCloseTo(Math.sqrt(14));
    const b2 = bounds.expand(b, vec3.of(-1, 5, 0));
    expect(b2.min).toEqual({ x: -1, y: 0, z: 0 });
    expect(b2.max).toEqual({ x: 1, y: 5, z: 3 });
    expect(b.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(bounds.contains(b2, vec3.of(0, 1, 1))).toBe(true);
    expect(bounds.contains(b2, vec3.of(2, 1, 1))).toBe(false);
  });

  it("handles the empty box, union and intersection", () => {
    expect(bounds.isEmpty(bounds.empty())).toBe(true);
    expect(bounds.fromPoints([])).toBeNull();
    const a = bounds.fromPoints([vec3.of(0, 0, 0), vec3.of(1, 1, 1)]);
    const c = bounds.fromPoints([vec3.of(0.5, 0.5, 0.5), vec3.of(2, 2, 2)]);
    if (!a || !c) return;
    expect(bounds.intersects(a, c)).toBe(true);
    const u = bounds.union(a, c);
    expect(u.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(u.max).toEqual({ x: 2, y: 2, z: 2 });
    expect(bounds.intersects(a, bounds.fromPoints([vec3.of(3, 3, 3), vec3.of(4, 4, 4)])!)).toBe(
      false,
    );
  });
});
