# geometry

Headless geometry, independent of every other repository package.

- `math.ts`: millimetre vectors, Z-up planes, projection, rays and rotation. `EPS` is 1e-5 mm.
- `arrangement.ts`: split segment intersections/overlaps, then recover planar cells by half-edge
  walking. `regions` returns outer loops and holes; it does not enumerate arbitrary graph cycles.
- `kernel.ts`: `initializeGeometry`, shared `triangulate`, general polygon `sweep`, `surfacesOf`,
  and signed mesh `volume`. Manifold WASM is bundled locally, initialized before editing, and freed
  after each boolean. Kernel failures propagate to the transaction boundary.

Public exports are in `src/index.ts`. `Surface` holds world-space outer/hole contours; `Mesh` holds
positions and indexed triangles. No kernel object crosses the boundary.

Run `npm test` for geometry behavior through core topology/volume tests.
See [0027](../../docs/decisions/0027-topology-rewrite.md) for the topology decision.
