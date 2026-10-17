# @gabarito/scene

**Status:** empty — no code yet

## Responsibility

The viewport. Everything between the document and the GPU.

- The Three.js renderer, scene graph, and render loop.
- Cameras and camera controls (orbit, pan, zoom, standard views, perspective/orthographic).
- The **single** conversion between document space (Z-up, millimetres) and render space
  ([decision 0008](../../docs/decisions/0008-units-coordinates-precision.md)).
- Derived geometry: meshes built from document entities and kept in sync on change.
- Picking and hit-testing, highlighting, selection outlines, hover feedback.
- Aids: grid, axes, section planes, shadows, sky.
- The viewport overlay slot plugins use to draw results into the 3D view
  ([lighting](../../docs/features/lighting-design.md) is the first consumer).

## Owns

All Three.js objects, and the axis/unit conversion.

## Must not

- Be authoritative for anything. The scene graph is a **derived view** of the entity graph
  ([invariant 5](../../docs/architecture/invariants.md)).
- Be imported by `ui` (React never touches the viewport) or by `tools`.
- Let Three.js types appear in any other package's public interface.

## Public interface

None yet. The viewport facade — the seam tools and plugins use — is defined by the viewport spec.

## Depends on

`@gabarito/core`, `@gabarito/geometry`, `three`.

## Read next

[`docs/decisions/0003-rendering-engine-threejs.md`](../../docs/decisions/0003-rendering-engine-threejs.md)
