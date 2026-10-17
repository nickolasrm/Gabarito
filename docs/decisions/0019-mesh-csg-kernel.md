---
id: 0019
title: Adopt a mesh CSG library for solid cuts
status: accepted
date: 2026-10-17
tags: [geometry, csg, kernel, dependency]
supersedes: [0011]
superseded_by: null
specs: [0016]
---

# 0019 — Adopt a mesh CSG library for solid cuts

> **Supersedes [0011](./0011-geometry-kernel-strategy.md)**, which deferred this and is now `rejected`.
> A cut is needed: pushing a face into a solid must remove material, not stack a second face on top of
> it ([spec 0016](../specs/0016-cut-holes-with-push-pull.md)).

## Context

[0011](./0011-geometry-kernel-strategy.md) decided to ship extrusion only and revisit when a feature
needed a boolean. That has happened: pushing a small face into an object leaves two stacked coplanar
faces instead of a hole, which blocks the two domains that matter most — an opening in a wall, and a
dado in a board.

**The convenient candidates are disqualified by our own rules.** `three-bvh-csg` and `three-csg-ts`
both operate on `three` geometry, and [module boundaries](../architecture/module-boundaries.md) keep
`three` out of `geometry`. They are ruled out on structure before performance. Two candidates respect
the boundaries. Both were spiked on a box with a recess, a wall with a door
opening, and a notch flush with the object's own face (the coplanar case joinery produces constantly):

| | [manifold-3d](https://github.com/elalish/manifold) | [@jscad/modeling](https://github.com/jscad/OpenJSCAD.org) |
|---|---|---|
| Licence | Apache-2.0 | MIT |
| Bundled subset, gzipped | 223 KB (541 KB wasm + 82 KB glue) | 58 KB |
| Init | WASM, asynchronous | synchronous |
| Volume error, all three cases | 0.0000% | 0.0000% |
| Manifold guarantee | explicit: `status === "NoError"`, genus reported | none; polygon soup, closedness is ours to check |
| Triangles out (recess / door / flush) | 28 / 28 / 28 | 28 / 28 / 28 |

The spike did **not** separate them on accuracy: both were exact on every case, including the coplanar
one. So the choice rests on cost and on what the guarantee is worth.

## Decision

**`@jscad/modeling` performs solid cuts, behind an interface owned by `packages/geometry`.**

- `geometry` exposes `subtract`, `union` and `intersect` over its own types. **No jscad type crosses the
  interface**, which is what keeps the choice reversible.
- It is synchronous, so booleans can run in a plain Node test with no WASM init, and no part of the boot
  path becomes asynchronous.
- 58 KB gzipped against 223 KB matters because the whole app is currently 220 KB gzipped and the
  hosting constraint makes payload a product requirement
  ([0001](./0001-static-hosting-github-pages.md)).
- The result is treated as **untrusted geometry**: `geometry` validates it before it reaches the
  document — closed, positively oriented, non-degenerate triangles. jscad offers no manifold
  guarantee, so we supply the check.
- **`manifold-3d` is the recorded fallback**, at a measured 223 KB gzipped, if validation starts
  rejecting results that woodworking joinery produces. It has the stronger guarantee, and it is a swap
  behind the same interface rather than a rewrite.

## Consequences

**Good:** cuts arrive without writing a kernel; the licence is MIT; the dependency is the smallest
option that respects the boundaries; synchronous booleans keep tests and boot simple; every result is
validated, so a bad cut is a caught error rather than a corrupt document.

**Bad:** a third-party dependency is now load-bearing for the one feature the whole product is aimed at,
and its maintenance is someone else's decision; we own the manifold check that a WASM kernel would have
given us, and that check costs code and time on every cut; the spike only exercised axis-aligned boxes
and does not demonstrate robustness on the messy input joinery actually produces, so the first real
artefact is likely to be found by a user rather than by a test; adding a dependency to `geometry` ends
its "zero dependencies" property, which was a stated virtue.

## Alternatives considered

| Alternative | Why not |
|---|---|
| `three-bvh-csg` or `three-csg-ts` | Both need `three`, which the boundaries keep out of `geometry`. Structured out before it was measured. |
| `manifold-3d` now | Genuinely the stronger candidate and the likely end state. Four times the payload for a guarantee that three simple cases could not show a need for. Kept as the measured fallback. |
| Build a B-rep kernel | Years, and not the differentiator. Unchanged from [0011](./0011-geometry-kernel-strategy.md). |
| Ray-casting or a CSG of our own on triangle soup | Writing the hardest part of a CAD kernel by hand, badly, on the critical path. |
| Do cuts in `scene` with a three-based library | Puts the kernel in the view layer, and the document's geometry would then depend on the renderer. |
| Keep stacking faces and cut nothing | What shipped and what was reported. A modeler that cannot make a hole cannot make a wall with a door. |

## Links

- Spec: [0016](../specs/0016-cut-holes-with-push-pull.md)
- Supersedes: [0011](./0011-geometry-kernel-strategy.md)
- Related: [0001](./0001-static-hosting-github-pages.md) (why payload is a requirement),
  [0004](./0004-repository-layout.md) (why `three` cannot move down)
