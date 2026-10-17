---
id: 0008
title: Millimetres, radians, Z-up, and precision rules
status: accepted
date: 2026-10-17
tags: [units, geometry, conventions, precision]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0008 — Millimetres, radians, Z-up, and precision rules

## Context

Unit and orientation conventions are cheap to choose now and expensive to change later, because they
are encoded in every saved file, every test, and every plugin. This is precisely the kind of decision
that a domain plugin — woodworking in millimetres, a lighting study in metres, an architectural plan
in feet and inches — will be tempted to reopen. It must not, or documents become unreadable.

The renderer brings its own conventions: Three.js is Y-up by default and has no opinion about units.

## Decision

- **Length: millimetres, internally, always.** Stored in the document and in all `geometry` APIs.
  Chosen because it is the finest common unit among woodworking (mm) and is trivially scaled to
  metres for architecture and lighting.
- **Angle: radians, internally, always.** Degrees exist only as display formatting.
- **Orientation: Z-up, right-handed.** X right, Y forward/depth, Z vertical — matching the
  construction convention SketchUp, Revit, and most CAD tools use, and matching how the intended
  users think about a building.
- **The renderer adapts at exactly one place.** `packages/scene` applies the single conversion
  between document space (Z-up, mm) and render space (Y-up, whatever unit scale is convenient). The
  conversion never leaks into tools, plugins, or the document.
- **Display units are presentation only.** A document stores a preferred display unit; a UI
  formatter converts for display and parses user input back to millimetres. No stored value is ever
  in a display unit.
- **Numeric type: IEEE-754 double (`number`) in the document and in `geometry` APIs.** Float32 is a
  render-time and storage-time concern only.
- **Comparison tolerance is explicit.** Geometry code compares with a named epsilon
  (`EPS_LENGTH`, `EPS_ANGLE`, `EPS_MERGE`) rather than `===` on computed values. Merging and snapping
  use a much coarser tolerance than equality checks.
- **Precision is a stated budget.** Millimetre-accurate for lengths up to building scale; planar and
  angular tolerance documented per operation. If an operation cannot meet the budget, that is a
  documented limitation in the spec, not a silent surprise.
- **Unit metadata is in the file.** Every project file records the unit system it was authored with,
  so a future unit-aware change has something to migrate from.

## Consequences

**Good:** no ambiguity about what a number means, anywhere; plugin authors have one rule to follow;
conversion to display units is a pure formatting concern that can be tested exhaustively; Z-up means
wall heights, floors, and light placement read naturally in code and match how the target users
describe their work; a single conversion point in `scene` makes the Y-up mismatch a contained, tested
translation rather than a distributed bug.

**Bad:** millimetres make very large models (a site plan in kilometres) produce large numbers, and
precision budgets must be stated explicitly; every Three.js integration point needs care not to
double-apply the axis conversion, which is an easy and confusing bug; imperial-oriented users get a
conversion layer they will scrutinise, so the formatter and parser must be well tested (feet, inches,
and fractional inches are genuinely fiddly); no compile-time unit safety — a metres value passed
where millimetres are expected compiles happily.

**Neutral:** the tolerance constants will need tuning as the geometry kernel matures
([0011](./0011-geometry-kernel-strategy.md)); the API surface for units lives in `core` and is small
on purpose.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Metres internally | Natural for architecture and lighting, but forces fractional millimetres for woodworking, which is the first domain. |
| Unit-agnostic "store whatever the user typed" | Guarantees a conversion mess once two domains meet in one document. |
| Feet/inches internally | Alignment with US construction, but poor fit for millimetre-precise joinery and awkward in code. |
| Y-up internally, matching Three.js | Removes one conversion but makes every architectural concept an axis permutation in code and in the user's head. |
| Float32 for storage | Halves file size, loses precision at building scale, and invites subtle snapping bugs. |
| Degrees internally | Friendlier in logs and debugging, but trigonometry and the geometry kernel want radians. |
| A units library with dimensional types | Strong safety, but a heavy dependency and awkward at the geometry-kernel hot path. Reconsider if unit bugs appear in practice. |

## Links

- Related: [0003](./0003-rendering-engine-threejs.md), [0006](./0006-document-model-and-commands.md),
  [0007](./0007-local-first-persistence.md), [0011](./0011-geometry-kernel-strategy.md)
- Glossary: [`../glossary.md`](../glossary.md)
