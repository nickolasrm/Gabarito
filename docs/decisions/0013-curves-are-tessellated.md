---
id: 0013
title: Curves are tessellated into straight edges
status: accepted
date: 2026-10-17
tags: [geometry, curves, tessellation, file-format]
supersedes: []
superseded_by: null
specs: [0007]
---

# 0013 — Curves are tessellated into straight edges

## Context

Circles and arcs are the first curved geometry the modeler needs. There are two ways to represent them:
as exact curves with a radius and a stored sweep, or as a chain of straight edges approximating them.

This matters immediately, because it is baked into the document format, the geometry kernel
([0011](./0011-geometry-kernel-strategy.md), still proposed), snapping, and every boolean operation
that will ever run on the result.

## Decision

**Curves are tessellated at creation time into straight edges, and no exact curve entity is stored.**

- A circle creates a regular polygon of `N` segments and a face; the segment count is chosen from a
  fixed setting (24 by default) at creation.
- The tessellation is a property of the created geometry, not a selectable "curve object": nothing in
  the document distinguishes a circle from any other closed loop of edges.
- Segment count is a user setting, applied at creation, and never retroactively applied to existing
  geometry.
- Coarse tessellation is visible and intentional: a small circle at high zoom looks faceted, and that
  is accepted in exchange for a simpler system.

## Consequences

**Good:** every downstream operation — triangulation, extrusion, snapping, booleans, export — sees only
edges, faces, and points, so none of them needs a curve concept; intersection and topology code is
written once; serialisation is trivial and has no curve parameters to version; exported meshes are
already the triangles the consumer wanted.

**Bad:** exactness is lost. A "circle" is not round, so radius inference, tangency, and precise
diameter measurements become approximations bounded by the segment count; large radii look wrong unless
the user raises the count, and raising it multiplies geometry everywhere, including in booleans; if the
product ever needs true arcs — CNC toolpaths, exact drawing export, or architectural curved walls — this
decision has to be revisited, and existing files cannot recover the curve they came from.

**Neutral:** the segment count becomes a setting users will ask about, and it interacts with the
precision budget in [0008](./0008-units-coordinates-precision.md). A future exact-curve entity would be
an additive change, not a rewrite, provided tools keep asking for "a circle" rather than "a polygon".

## Alternatives considered

| Alternative | Why not |
|---|---|
| Exact curve entities (radius + sweep + plane) | Correct and compact, but every operation in the kernel, the snapper, the picker, and the exporter then has two cases to handle — a large tax paid immediately for precision the first use cases do not need. |
| NURBS surfaces | Right for mechanical CAD, far beyond this product's needs, and incompatible with the adopted mesh approach. |
| Adaptive tessellation per curve based on screen size | Better looking, but geometry that changes with the camera makes the document non-deterministic and export unstable. |
| Tessellate at render time only, keep curves in the document | Gets both, but means the document's geometry is not the geometry that operations run on, which reintroduces the two-case problem. |

## Links

- Related: [0011](./0011-geometry-kernel-strategy.md), [0008](./0008-units-coordinates-precision.md),
  [0006](./0006-document-model-and-commands.md)
- Specs: [0007](../specs/0007-drawing-and-transform-tools.md)
