---
id: 0016
title: Cut holes with push/pull
status: proposed
date: 2026-10-17
packages: [geometry, core, tools]
decisions: [0019]
supersedes: null
---

# 0016 — Cut holes with push/pull

## Goal

Pushing a face **into** a solid removes material, and pulling it **out** adds it — one tool, both
directions, the way a modeler is expected to work. After this spec, a wall can have a door opening and a
board can have a dado, instead of two coplanar faces stacked on top of each other.

## Why now

Reported directly, and it is the last blocker on the two domains the product exists for. Today
push/pull always extrudes ([decision 0011](../decisions/0011-geometry-kernel-strategy.md)); the kernel
decision that unblocks this is [0019](../decisions/0019-mesh-csg-kernel.md), which adopted
`@jscad/modeling` behind an interface in `geometry`.

## Scope

**In scope**

- `geometry`: `subtract`, `union`, `intersect` over its own types, plus the validation that makes an
  unguaranteed library's output safe to store.
- A **shell**: the closed set of faces that bounds a solid, computed from connectivity rather than
  stored, so the document format does not change.
- `core`: a command that replaces a shell's faces with the result of a boolean, with an inverse.
- `tools`: push/pull decides between extrude and subtract from the drag direction relative to the face's
  solid, and previews which one it will do.
- Tests: unit for the boolean and the validation, browser for push into and pull out of a real solid.

**Out of scope**

- Storing shells, or any change to the entity kinds. Shells are derived on demand.
- Union and intersect as *tools*. Only the geometry operations ship here; the tools that would use them
  come later.
- Self-intersection repair, filleting, chamfers, and non-mesh surfaces.
- Cuts through a curved tessellated face beyond what a triangle boolean already handles
  ([0013](../decisions/0013-curves-are-tessellated.md)).
- Performance work beyond a documented budget: a cut on a building-scale model must not block the UI,
  and offloading it to a worker is a separate spec.

## Plan

1. Add `@jscad/modeling` to `packages/geometry` and wrap it: convert our faces to jscad polygons and back,
   leaking no jscad types.
2. Validate every result: closed (each edge shared by exactly two triangles), positive orientation,
   no degenerate triangles, non-empty. Reject rather than store something broken.
3. Shell detection in `geometry`: from a face, walk the shared-edge adjacency until the surface closes;
   fail cleanly when it does not.
4. `core`: `cutSolid(shellFaces, toolSolid)` as a command, capturing the removed faces so undo restores
   them exactly.
5. `tools`: push/pull compares the drag direction with the face's outward normal. Into the solid →
   subtract a prism swept from the face by the drag distance; out of it → the existing extrude. The
   preview shows which, and the readout says so.
6. Tests, then a browser pass over a wall with a door and a board with a dado.

## Design notes

**Why shells are computed, not stored.** Storing a shell means the entity graph gains a parent that every
tool must maintain, and the format changes. Computing it on demand from shared edges keeps the document
as it is and keeps this spec reversible: if derivation turns out to be too slow on big models, a cached
index is a later change behind the same function.

**Why the result is validated.** [0019](../decisions/0019-mesh-csg-kernel.md) chose a library with no
manifold guarantee. A cut that produces an unclosed surface would corrupt the model quietly, and the
user would meet it later as snapping that no longer works. Rejecting is the honest failure: the tool
reports that the cut failed and leaves the document untouched.

**Why the tool, not the kernel, decides add vs remove.** The geometry layer knows nothing about drags or
solids-of-interest. Push/pull owns the intent, and the kernel owns the arithmetic.

## Risks

| Risk | Mitigation |
|---|---|
| jscad produces an unclosed or inverted result | Every result is validated before it is stored; failure cancels the operation and reports it, leaving the document unchanged. |
| A cut is slow enough to stall the UI on a large model | Document a budget, measure the two test cases, and defer a worker to its own spec rather than half-building one. |
| Shell detection walks the whole model, or fails on an open surface | Bound the walk, and when the surface does not close, refuse the cut with a message instead of subtracting from an arbitrary set of faces. |
| Cuts leave near-degenerate slivers that break later snapping | Validate triangle area and merge vertices within an epsilon, using [0008](../decisions/0008-units-coordinates-precision.md)'s tolerances. |
| The interface leaks jscad types and the fallback stops being a swap | A test asserts no jscad type appears in a public signature, the same way the boundary tests check imports. |
| Undo restores the wrong thing after a cut | The inverse captures the exact faces removed, and the inverse test applies, cuts, undoes, and compares to the pre-cut document. |

## Verification

- [ ] `geometry.subtract` on the recess, door and flush cases returns the exact expected volume
- [ ] A deliberately broken result is rejected, not stored
- [ ] Shell detection finds the six faces of a box and refuses an open surface
- [ ] The inverse test passes for a cut, and undo restores the pre-cut document exactly
- [ ] Browser: pushing a face into a box makes a recess whose volume matches the drag
- [ ] Browser: pulling out still extrudes, unchanged
- [ ] No jscad type appears in a public signature
- [ ] A wall with a door opening renders with no stacked faces

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/decisions/README.md`
- [ ] `packages/geometry/README.md`, `packages/core/README.md`, `packages/tools/README.md`
- [ ] `docs/features/sketchup-core.md`: push/pull capability, and `docs/glossary.md` for *shell*

## Result

> Filled in when the spec is closed. Deliberately left `proposed`: the kernel is decided, the
> implementation is not written, and this spec is the plan rather than a record.
