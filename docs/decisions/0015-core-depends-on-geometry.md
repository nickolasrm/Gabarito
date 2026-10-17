---
id: 0015
title: core may depend on geometry
status: accepted
date: 2026-10-17
tags: [structure, boundaries, core, geometry]
supersedes: []
superseded_by: null
specs: [0009]
---

# 0015 — core may depend on geometry

## Context

[Decision 0004](./0004-repository-layout.md) and
[`module-boundaries.md`](../architecture/module-boundaries.md) state that `core` and `geometry` both
import nothing, putting them side by side as leaves.

Implementing the document model showed that this is wrong. `core` must answer questions that are
geometry: the plane and normal of a face before extruding it, the bounds of the document, the length
of a distance for a dimension, whether a loop of points is planar before turning it into a face. The
first construct operations in
[spec 0004](../specs/0004-core-document-geometry-viewport.md) need all four.

The alternatives were to duplicate that maths inside `core` or to record the real dependency. Two
implementations of a polygon normal that can drift is precisely the kind of silent divergence the
boundary rules exist to prevent.

## Decision

**`core` may import `@gabarito/geometry`. `geometry` may not import `core`.**

- `geometry` remains a true leaf: no imports, no DOM, no `three`, testable in isolation.
- `core` depends on the geometry primitives and nothing else beyond that.
- `plugin-api` remains a leaf, independent of both.
- The dependency direction is therefore `geometry → core → {scene, tools, ui, persistence} → app`,
  which is still strictly inward: nothing imports its own consumer.
- `core` re-exports the geometry types it uses (`Vec3`, `Bounds`) so that consumers of `core` do not
  have to reach into `geometry` for them.

This does not conflict with [invariant 9](../architecture/invariants.md), which forbids packages from
importing their consumers; `geometry` is not a consumer of `core`.

## Consequences

**Good:** one implementation of every numerical rule, in the package that owns numerical guarantees;
`core` can express construct operations (weld, edge, rectangle, extrusion) without reimplementing
vector maths; tests for tolerance behaviour live in one place; consumers of `core` get the geometry
types transitively.

**Bad:** `geometry` and `core` can no longer be reasoned about as one interchangeable bottom layer —
`geometry` changes now have a downstream blast radius into `core`; a bug in `geometry` can corrupt the
document rather than merely mis-render it; the layer diagram grows an arrow that the original layout
record implied did not exist.

**Neutral:** `plugin-api` and `geometry` are now the two leaves, so the "no imports" lint has to be
applied per package rather than to a pair. Whether `persistence` should also sit beside `core` is not
answered here and will be settled when the file format is specified.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Duplicate the needed maths inside `core` | Two implementations of Newell's method and of tolerance comparisons, which will diverge silently. |
| Move the document model into `geometry` | Makes the leaf package own mutable application state, which is a larger violation. |
| Move the maths into `core` and make `geometry` a consumer | Inverts the dependency: `geometry` is pure and testable with no state, and it would lose that. |
| Keep the rule and let tools do the maths, passing results into `core` | Pushes geometric correctness into every call site, which is where it will be forgotten. |

## Links

- Boundary change: [spec 0009](../specs/0009-boundary-core-depends-on-geometry.md)
- Related: [0004](./0004-repository-layout.md), [0006](./0006-document-model-and-commands.md)
- Normative detail: [`../architecture/module-boundaries.md`](../architecture/module-boundaries.md)
