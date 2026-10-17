---
id: 0016
title: Cut holes with push/pull
status: proposed
date: 2026-10-17
packages: [core, geometry, tools]
decisions: [0021]
supersedes: null
---

# 0016 — Cut holes with push/pull

## Goal

Pushing a face **into** a solid removes material, and pulling it **out** adds it — one tool, both
directions. After this spec, a wall has a door opening and a board has a dado, instead of two coplanar
faces stacked on top of each other.

## Why now

Reported directly, and it is the last blocker on the two domains the product exists for. Push/pull today
only extrudes ([decision 0011](../decisions/0011-geometry-kernel-strategy.md)); the approach is settled
in [decision 0021](../decisions/0021-straight-cuts-by-face-surgery.md), which dropped the CSG library
route after measuring it and chose rectangular face surgery instead.

## Scope

**In scope**

- A **shell**: the closed set of faces bounding a solid, computed from shared-edge connectivity rather
  than stored, so the document format does not change.
- Rectangle arithmetic in `geometry`: subtract one rectangle from another in a plane, and split a
  swept rectangle into the faces of the opening. At most four rectangles out, never a hole.
- `core`: a command that replaces a shell's faces with the cut result, with an inverse that restores
  them exactly.
- `tools`: push/pull decides between extrude and cut from the drag direction, previews which it will do,
  and says so in the readout.
- A clear refusal, in the status bar, when the shell is not a box of axis-aligned rectangles or the tool
  is not axis-aligned.
- Tests: rectangle arithmetic and the shell walk as units, and a real cut through the browser.

**Out of scope**

- Anything not axis-aligned. A rotated wall, a curved surface, a tool at an angle: refused, with a
  message. This is the ceiling [0021](../decisions/0021-straight-cuts-by-face-surgery.md) accepted.
- Storing shells, holes in a face, or any change to the entity kinds.
- Union and intersect as tools. Only the cut ships here.
- Cut through one solid and into another, or across several shells at once.
- Offloading a cut to a worker. A cut is subtraction on a handful of rectangles; if it ever needs a
  worker that is a separate spec with its own measurements.

## Plan

1. `geometry`: `rect.subtract(outer, inner)` returning up to four rectangles in the outer's plane, and
   the small helpers to express a face's rectangle and to test axis-alignment.
2. `geometry`: `rect.split(tool, shellExtent)` returning the tool's own faces that lie inside the shell —
   side walls, and a floor when the cut does not pass through — skipping any coplanar with a shell face.
3. `core`: `closedShell(doc, faceId)` walking shared edges to the faces that bound the solid, refusing
   when the surface does not close or is not a box of axis-aligned rectangles.
4. `core`: `cutShell(doc, shellFaceIds, tool)` producing the replacement entity set, and the command
   `{ type: "cutShell", … }` whose inverse restores the removed entities unchanged.
5. `tools`: push/pull compares the drag with the face's outward normal. Into the solid → cut; out of it
   → the existing extrude. The preview shows which, and `readout` names it.
6. Tests at each layer, then a browser pass over a door opening and a dado.

## Design notes

**Why this is not a kernel.** [Decision 0021](../decisions/0021-straight-cuts-by-face-surgery.md) has the
measurements. The short version: the operation push/pull needs is the subtraction of an axis-aligned box
from an axis-aligned box, and the general case costs a dependency, a WASM bridge and a validation layer
for geometry this product does not produce yet.

**Why "at most four rectangles" matters.** A face in this document is a single loop, so it cannot hold a
hole. A rectangle minus a contained rectangle is a ring, which is four rectangles and no hole — and when
the inner rectangle touches an edge or covers the face, it is fewer. That is the whole reason the narrow
case is expressible at all, and it is why the general case is not.

**Why the refusal is part of the feature.** Half-working geometry is worse than a refusal: a solid that
is silently wrong corrupts snapping, selection and every later cut. The tool says it cannot do it and
changes nothing.

## Risks

| Risk | Mitigation |
|---|---|
| A shell that is not a box is refused, and users meet that often | The message names why. The ceiling is recorded in [0021](../decisions/0021-straight-cuts-by-face-surgery.md) as the thing to supersede first if it hurts. |
| Rectangle arithmetic drifting at the boundaries | All comparisons use [0008](../decisions/0008-units-coordinates-precision.md)'s tolerances, and the cases where the tool is flush with a face are tested explicitly, because that is where the library route broke. |
| The shell walk picking up the wrong faces on touching solids | The walk stops at the first face that does not close the surface cleanly and refuses, rather than cutting into a set it cannot verify. |
| A cut leaving slivers that break snapping later | Rectangles smaller than the merge tolerance are dropped, and the result is rebuilt through the existing weld so shared corners stay shared. |
| Undo restoring the wrong faces | The inverse captures the exact entities removed, and an inverse test applies, cuts, undoes, and compares to the pre-cut document. |

## Verification

- [ ] `rect.subtract` on the contained, edge-touching, covering and non-overlapping cases
- [ ] `rect.split` skips the tool faces coplanar with the shell
- [ ] `closedShell` finds a box's six faces and refuses an open surface
- [ ] The inverse test passes for a cut, and undo restores the pre-cut document exactly
- [ ] A recess is shallower than the solid and a door opening passes through
- [ ] A non-axis-aligned shell is refused with a message, and the document is unchanged
- [ ] Browser: pushing a face into a box leaves an opening, and pulling out still extrudes

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/decisions/README.md`
- [ ] `packages/{geometry,core,tools}/README.md`
- [ ] `docs/features/sketchup-core.md` (push/pull) and `docs/glossary.md` (shell)

## Result

> Filled in when the spec is closed. Left `proposed`: the approach is decided, the implementation is not
> written, and this spec is the plan rather than a record.
