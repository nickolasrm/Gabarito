# geometry

Headless geometry, independent of every other repository package.

- `math.ts`: millimetre vectors, Z-up planes, projection, rays and rotation. `EPS` is 1e-5 mm.
- `arrangement.ts`: split segment intersections/overlaps, then recover planar cells by half-edge
  walking. `regions` returns outer loops and holes; it does not enumerate arbitrary graph cycles.
- `kernel.ts`: `initializeGeometry`, shared `triangulate`, general polygon `sweep`, `surfacesOf`,
  signed mesh `volume`, and `mergeCoplanar` for oriented surface unions/cancellations. Manifold WASM is bundled locally, initialized before editing, and freed
  after each boolean. Kernel failures propagate to the transaction boundary.

Public exports are in `src/index.ts`. `Surface` holds world-space outer/hole contours; `Mesh` holds
positions and indexed triangles. No kernel object crosses the boundary.

Run `npm test` for geometry behavior through core topology/volume tests.
See [0027](../../docs/decisions/0027-topology-rewrite.md) for the topology decision.

`scale(point, anchor, factors)` applies component-wise factors about a fixed anchor. Core scale
commands and tools previews use the same formula; command validation belongs to core.

`circlePoints(center, frame, radius, segments = 24, radial = frame.u)` returns a regular planar loop
with exact vertex radii. The projected radial direction fixes its first vertex; degenerate input
uses frame U. Positive finite radius and 3–256 segments are validated. Curves remain ordinary edges.

`insetContours(surface, distance)` erodes face material with Manifold CrossSection miter joins in
face-local coordinates. It normalizes outer/hole winding, returns every world-space contour (including
split islands and expanded holes), and deletes all temporary WASM sections. Distances must exceed
EPS and complete collapse throws. `insetDistance(surface, point)` returns the minimum perpendicular
boundary distance for a material point, or null off-plane/outside/in a hole. Preview and core use
these helpers. Angled offsets use boundary distance, not bounding-box scaling or radial shrinkage.
