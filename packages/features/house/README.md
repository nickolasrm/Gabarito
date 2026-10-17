# @gabarito/feature-house

**Status:** empty — planned, not started

Plugin id: `gabarito.house` · Plan: [`docs/features/house-building.md`](../../../docs/features/house-building.md)

## Responsibility

Architectural semantics: the concepts a modeler can draw but cannot mean.

- Levels / storeys, and views that select a level and a cut plane.
- Wall, floor, ceiling, and roof assemblies — ordered layers with materials, not single slabs.
- Openings (doors, windows) that cut through a whole assembly and re-solve their host.
- Rooms and areas with names, functions, and computed area/volume.
- Parametric stairs, railings, foundations.
- Annotation: dimensions, tags, room labels, plan sheets at scale.
- Schedules and quantity takeoff derived from the model.
- Site and terrain.

## Depends on

`@gabarito/plugin-api` only. Nothing else, ever
([boundaries](../../../docs/architecture/module-boundaries.md)).

## Notes for the implementing agent

- **Layered assemblies** and **levels/views** are the two concepts most likely to push on the core.
  Decide deliberately: plugin entity types are the default, and promoting anything into the core
  requires a spec plus an ADR.
- Nothing here may import the lighting or woodworking plugins. A house containing a lighting study is
  composed through the host, not through a dependency.
