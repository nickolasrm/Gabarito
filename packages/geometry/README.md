# @gabarito/geometry

**Status:** implemented — pure maths, zero dependencies, zero imports

## Responsibility

Every numerical guarantee in the product. Testable in plain Node, with no browser and no GPU.

- Vectors, planes, rays, segments, bounds, and named tolerances (`EPS`).
- Polygons: normals, area, centroid, planarity, point containment, winding.
- Triangulation by ear clipping, including concave loops.
- Extrusion into closed solids and caps.
- Rotation, translation and mirroring about an axis or plane.

## Public interface

```ts
vec3          of, add, sub, scale, mul, dot, cross, len, normalize, lerp, dist, equals, isZero …
rect          fromPolygon, intersect, subtract (a ring becomes at most four rectangles),
              corners, cornersOutward, conformRects (no T-junctions across shared edges)
plane         fromPoints, fromPointNormal, fromAxis, distanceToPoint, projectPoint, contains, flip
ray           of, at, intersectPlane, intersectSegment, closestPointsToSegment
segment       length, direction, midpoint, closestPointToPoint, closestPoints
poly          normal, area, centroid, isPlanar, containsPoint, orient, dedupe, signedArea2D
triangulate   polygon (ear clipping), fan
extrude       prism, walls, cap
transform     rotatePointAroundAxis, rotatePointsAroundAxis, translate, mirrorPoint
bounds        empty, fromPoints, expand, union, contains, intersects, center, size, diagonal
angle         between, signedAround, toDegrees, toRadians
EPS           LENGTH, ANGLE, MERGE, PARALLEL
```

Lengths are millimetres, angles radians, world Z-up, right-handed
([decision 0008](../../docs/decisions/0008-units-coordinates-precision.md)).

## Must not

- Import anything, not even another Gabarito package. Enforced by a test
  ([decision 0015](../../docs/decisions/0015-core-depends-on-geometry.md)).
- Import Three.js, React, or touch the DOM.
- Mutate its inputs, or hold any state between calls.

## Depends on

Nothing.

## Test

`npm test` — `packages/geometry/src/geometry.test.ts`.

## Read next

[`docs/decisions/0011-geometry-kernel-strategy.md`](../../docs/decisions/0011-geometry-kernel-strategy.md) ·
[`docs/decisions/0013-curves-are-tessellated.md`](../../docs/decisions/0013-curves-are-tessellated.md)
