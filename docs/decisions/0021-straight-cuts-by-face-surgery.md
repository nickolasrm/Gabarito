---
id: 0021
title: Straight cuts are face surgery, not a CSG kernel
status: accepted
date: 2026-10-17
tags: [geometry, csg, kernel, dependency, scope]
supersedes: [0019]
superseded_by: null
specs: [0016]
---

# 0021 — Straight cuts are face surgery, not a CSG kernel

> **Supersedes [0019](./0019-mesh-csg-kernel.md)**, which adopted a mesh CSG library. It was measured
> against the first real cut, it failed, and the requirement turned out to be narrower than the tool.

## Context

[0019](./0019-mesh-csg-kernel.md) chose `@jscad/modeling` over `manifold-3d` on measured cost, having
found both exact on a recess, a door opening and a coplanar flush notch. That record named the trigger
for revisiting it: *"if validation starts rejecting results that joinery produces"*.

The trigger fired on the very first cut. The same three cases, run through the adopted library, left
**16 edges used once** — T-junctions, where the top face's boundary and the side walls were tessellated
in disagreement. The document cannot hold that: an unclosed shell breaks snapping later, so validation
refused it. `manifold-3d` returned **42 of 42 edges paired** on all three cases, so the recorded
fallback was switched in, at its measured 223 KB gzipped.

The fallback then failed too, at the wrapper rather than the maths: two attempts at the input mesh were
rejected with `ManifoldError: Not manifold` while the same mesh passed our own closedness and volume
checks. That is a solvable bug, and solving it was not the point. The point was that this had become a
kernel-integration project for a requirement stated in one sentence.

**What is actually needed.** Push/pull produces an axis-aligned rectangular prism. The user's cases are
a door opening through a wall and a dado in a board. Both are the subtraction of an axis-aligned box
from an axis-aligned box. A general CSG kernel is four hundred kilobytes, a WASM bridge, an
asynchronous boot, and a validation layer we would have to own — bought for a case that is entirely
rectangular arithmetic.

## Decision

**No CSG library. A straight cut is face surgery on axis-aligned rectangles.**

- The tool is the pushed face's rectangle swept along its normal by the drag distance.
- For **every** face of the shell, the tool's rectangle is subtracted from that face **in the face's own
  plane**. A rectangle minus a rectangle is at most four rectangles and never a hole, which is what
  makes this expressible in a document whose faces are single loops.
- The tool's own faces that end up **inside** the shell are added: the four side walls of the opening,
  and its floor when the cut does not pass through. A tool face coplanar with a shell face is skipped, or
  the result would carry two coincident faces.
- Rebuild points, edges and faces from the resulting rectangle set through the existing construct
  helpers, so welding and undo work unchanged.
- **Refuse anything else, loudly.** A shell that is not a box of axis-aligned rectangles, or a tool that
  is not axis-aligned, cancels the operation with a message in the status bar. A clear refusal is worth
  more than a wrong solid.
- The dependency is removed: `geometry` has no runtime dependency again.

## Consequences

**Good:** the feature arrives with no dependency, no WASM, no asynchronous boot, no 220 KB, and no
validation layer to own; every step is rectangle arithmetic that can be tested exactly and read in one
sitting; the common shapes in this product — walls, boards, boxes — are all axis-aligned, so the narrow
case covers the domain rather than a corner of it; and the document model stays as it is, because a
rectangle minus a rectangle never needs a hole in a face.

**Bad:** a cut at an angle, or into anything that is not an axis-aligned box, is refused — a rotated
wall, a curved surface, any non-box shell. That is a real ceiling, lower than the library route would
have had, and users will meet it as a message rather than a shape.

**Neutral:** the general problem is untouched rather than solved. If a rotated wall or a curved opening
is needed later, this record is the one to supersede, and the spike data for both libraries is already
in [0019](./0019-mesh-csg-kernel.md) — including the measurement that manifold-3d is the one that
produces closed results.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep debugging `manifold-3d` | The third attempt at a wrapper for a one-sentence requirement, with 223 KB and an async boot attached. Recorded here as the fallback if the narrow approach hits its ceiling. |
| `@jscad/modeling` | Measured: T-junctions on all three cases, 16 edges used once. Rejected by our own validation, correctly. |
| A 2D polygon-clipping library instead of a kernel | Still a dependency, and the hard part is not clipping: a subtracted face can have a hole, and a face in this document cannot hold one. |
| Keep stacking faces and cut nothing | The reported bug. A modeler that cannot make a hole cannot make a wall with a door. |
| Build a general kernel | Years, and unchanged from [0011](./0011-geometry-kernel-strategy.md). |

## Links

- Spec: [0016](../specs/0016-cut-holes-with-push-pull.md)
- Supersedes: [0019](./0019-mesh-csg-kernel.md)
- Related: [0011](./0011-geometry-kernel-strategy.md) (the first deferral),
  [0008](./0008-units-coordinates-precision.md) (tolerances for the arithmetic)
