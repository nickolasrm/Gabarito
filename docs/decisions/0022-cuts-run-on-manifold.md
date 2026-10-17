---
id: 0022
title: Cuts run on manifold-3d
status: accepted
date: 2026-10-17
tags: [geometry, csg, kernel, dependency]
supersedes: [0021]
superseded_by: null
specs: [0016]
---

# 0022 — Cuts run on manifold-3d

## Context

[0021](./0021-straight-cuts-by-face-surgery.md) dropped the CSG library and cut by subtracting
rectangles from faces by hand. The implementation ran its course on `feat/straight-cuts`: a recess
in a box face produces the right 14 faces, but a cut **through** the solid leaves an edge used by one
face instead of two, and the volume of a closed result reads a third low — inconsistent winding.
A full debugging pass ended at "dump every face and read them", which is kernel debugging by hand.

The record already holds the way out. [0019](./0019-mesh-csg-kernel.md) measured `manifold-3d`
returning a closed mesh on every joinery case — 42 of 42 edges paired where `@jscad/modeling`
left T-junctions. The 0021-era attempt to switch it in failed at the **wrapper**, not the maths:
`ManifoldError: Not manifold` on input that passed our own closedness checks. The cause is known —
the kernel was fed the document's face soup as a raw mesh, and a kernel only owes an answer to
input that is itself manifold.

## Decision

**`manifold-3d` performs the subtraction, behind an interface owned by `packages/geometry`.**

- The kernel never sees the document's faces. `geometry` owns `solid` over its own types: the cut
  takes two **axis-aligned boxes** (the shell's extent, the pushed rectangle swept by the drag) and
  returns welded triangles with consistent outward winding. Primitive boxes are manifold by
  construction, which is what the failed wrapper got wrong.
- Validity of the *document* side stays where it is: the shell walk must still close, and the solid
  must still be a box of axis-aligned rectangles ([0021](./0021-straight-cuts-by-face-surgery.md)'s
  refusals unchanged). The kernel is for the cut, not for trusting arbitrary input.
- `core` converts the kernel mesh back to entities by welding vertices, grouping triangles that are
  coplanar, and reading each group's boundary loops. Topology — which edges exist and which faces
  own them — comes from the kernel mesh, not from face arithmetic. A face group that is a ring
  (rectangle with a rectangular hole) is split by the existing `rect.subtract`, at most four
  rectangles, because a face in the document is a single loop.
- No manifold type crosses the interface; the dependency lives in `geometry` and stays swappable.
- Init is asynchronous WASM. `geometry` starts it on first use and `planCut` reports "loading"
  rather than blocking boot.

## Consequences

**Good:** a through cut is closed by construction instead of by debugging; winding is the kernel's
guarantee rather than our convention; the two known surgery failures disappear along with the
arithmetic that produced them; the 0021 refusals keep guarding the document from half-work.

**Bad:** 223 KB gzipped on a static host where payload is a product requirement
([0001](./0001-static-hosting-github-pages.md)), a WASM bridge in `geometry`, the end of its
zero-dependency property, and a mesh-to-faces conversion layer we own. The first cut after load can
meet a "still loading" message.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Finish debugging the face surgery | A session was spent; the remaining bugs are topology bugs the kernel guarantees away. Recorded as the fallback if the kernel wrapper fails again. |
| `@jscad/modeling` | Measured: T-junctions on every case ([0021](./0021-straight-cuts-by-face-surgery.md)). Rejected by validation, correctly. |
| Fix the wrapper that rejected our mesh | It rejected because input was not manifold; the fix is primitive input, which is this decision. |

## Links

- Spec: [0016](../specs/0016-cut-holes-with-push-pull.md)
- Supersedes: [0021](./0021-straight-cuts-by-face-surgery.md)
- Related: [0019](./0019-mesh-csg-kernel.md) (the measurements),
  [0008](./0008-units-coordinates-precision.md) (tolerances),
  [0001](./0001-static-hosting-github-pages.md) (payload cost)
