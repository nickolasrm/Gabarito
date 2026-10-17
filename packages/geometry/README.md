# @gabarito/geometry

**Status:** empty — no code yet ([spec 0003](../../docs/specs/0003-geometry-kernel-spike.md) decides the kernel)

## Responsibility

Pure mathematics. The part of the system that can be tested in plain Node with no browser and no GPU.

- Vectors, matrices, planes, rays, bounding boxes.
- Curves and tessellation: lines, arcs, circles, polygons.
- Meshes and minimal topology: vertices, edges, faces, adjacency, closedness.
- Solid operations behind a stable interface: extrude, push/pull, boolean, offset, slice.
- Inference math: snapping candidates, intersections, axis and parallel locks.
- Tolerance constants (`EPS_LENGTH`, `EPS_ANGLE`, `EPS_MERGE`).

## Owns

Every numerical guarantee in the product. Lengths are millimetres, angles radians, world is Z-up
([decision 0008](../../docs/decisions/0008-units-coordinates-precision.md)).

## Must not

- Import Three.js, React, or any browser global — not even as a type
  ([decision 0003](../../docs/decisions/0003-rendering-engine-threejs.md)).
- Import `core`. `core` may import this, not the reverse.
- Expose a third-party boolean library's types through its public interface; the kernel stays swappable
  ([decision 0011](../../docs/decisions/0011-geometry-kernel-strategy.md)).

## Public interface

None yet. Defined by the geometry spec that follows the kernel spike.

## Depends on

Nothing.

## Read next

[`docs/decisions/0011-geometry-kernel-strategy.md`](../../docs/decisions/0011-geometry-kernel-strategy.md) ·
[`docs/decisions/0008-units-coordinates-precision.md`](../../docs/decisions/0008-units-coordinates-precision.md)
