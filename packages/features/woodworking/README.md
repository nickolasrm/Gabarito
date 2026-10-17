# @gabarito/feature-woodworking

**Status:** empty — planned, not started

Plugin id: `gabarito.woodworking` · Plan: [`docs/features/woodworking.md`](../../../docs/features/woodworking.md)

## Responsibility

The woodworking domain: what makes a model a *buildable* piece of furniture rather than a shape.

- Material and stock library (sheet goods, solid lumber, finishes).
- A board entity with thickness and grain direction.
- Joinery tools and commands: dado, rabbet, mortise and tenon, dowel, pocket screw, dovetail.
- Assembly groups that know which boards meet.
- Cut-list computation and layout/nesting on sheet goods.
- Dimension formatting conventions for the trade (fractions, thickness callouts).
- Export: CSV and PDF cut lists, DXF for CNC.

## Depends on

`@gabarito/plugin-api` only. Nothing else, ever
([boundaries](../../../docs/architecture/module-boundaries.md)).

## Notes for the implementing agent

Every capability above must be expressible as a contribution: entity type, command, tool, panel,
importer, exporter, validator. If one is not, the correct move is a spec extending the plugin API —
not an import from `core`.
