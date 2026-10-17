---
id: 0016
title: Cut holes with push/pull
status: implemented
date: 2026-10-17
packages: [core, geometry, tools]
decisions: [0022]
supersedes: null
---

# 0016 — Cut holes with push/pull

## Goal

Pushing a face **into** a solid removes material, and pulling it **out** adds it — one tool, both
directions. After this spec, a wall has a door opening and a board has a dado, instead of two coplanar
faces stacked on top of each other.

## Why now

Reported directly, and it is the last blocker on the two domains the product exists for. Push/pull today
only extrudes ([decision 0011](../decisions/0011-geometry-kernel-strategy.md)). The face-surgery route of
[decision 0021](../decisions/0021-straight-cuts-by-face-surgery.md) ran its course with two failures it
could not debug away — an unclosed through cut and inconsistent winding — so
[decision 0022](../decisions/0022-cuts-run-on-manifold.md) supersedes it and the cut runs on `manifold-3d`.

## Scope

**In scope**

- A **shell**: the closed set of faces bounding a solid, computed from shared-edge connectivity rather
  than stored, so the document format does not change. Already on the branch.
- A `solid` module in `geometry`: `manifold-3d` behind our own types — two axis-aligned boxes in, welded
  triangles with consistent outward winding out. No manifold type crosses the interface.
- `core`: a cut plan that subtracts the tool from the shell through the kernel and converts the result
  back to entities: weld vertices, group coplanar triangles, read boundary loops, split a ring face by
  `rect.subtract` (at most four rectangles — a document face is a single loop).
- `tools`: push/pull decides between extrude and cut from the drag direction, previews which it will do,
  and says so in the readout.
- A clear refusal, in the status bar, when the shell does not close, is not a box of axis-aligned
  rectangles, or the tool is not axis-aligned.
- Tests: rectangle arithmetic and the shell walk as units, kernel cut at the unit layer, and a real cut
  through the browser.

**Out of scope**

- Anything not axis-aligned. A rotated wall, a curved surface, a tool at an angle: refused, with a
  message. The kernel could take more, but the mesh-to-faces conversion is the ceiling, and it is
  narrower than the kernel, not the kernel.
- Storing shells, holes in a face, or any change to the entity kinds.
- Union and intersect as tools. Only the cut ships here.
- Cut through one solid and into another, or across several shells at once.
- Offloading a cut to a worker. One box-minus-box subtraction is microseconds; if that changes it is a
  separate spec with its own measurements.

## Plan

1. `geometry`: add `manifold-3d`; `solid.subtract(shellBox, toolBox)` returning welded triangles, with a
   memoised async `init` for the WASM. `rect.*` from the surgery round stays — the ring split uses it.
2. `core`: `cut.ts` drops face surgery for the kernel result: shell walk and the axis-aligned box check
   stay as the refusal gate, then welded triangles become points, edges and faces — topology from the
   kernel mesh, rings split by `rect.subtract`.
3. `core`: `planCut` reports `{ kind: "cut" | "extrude" }` or an error, matching the shape the push/pull
   tool already expects; extrude when the drag leaves the solid.
4. `tools`: push/pull reports cut vs add in the readout, and a refusal message on an unusable shell.
5. Tests at each layer — including the two surgery failures (through cut closed, correct volume) — then
   a browser pass over a door opening and a dado.

## Design notes

**Why the kernel again.** [Decision 0022](../decisions/0022-cuts-run-on-manifold.md). The short version:
the surgery produced nearly-right topology by arithmetic, and the last mile — edges used exactly twice,
winding outward everywhere — is precisely what a mesh CSG kernel guarantees. The earlier wrapper failure
was a kernel fed a face soup; here it only ever subtracts two primitive boxes.

**Why "at most four rectangles" still matters.** A face in this document is a single loop, so it cannot
hold a hole. The kernel happily returns a ring; the conversion layer splits it back into rectangles. A
non-rectangular loop out of the kernel is refused — the input is two boxes, so anything else is a bug.

**Why "loading" is part of the feature.** WASM init is asynchronous and boot must not become so. The
kernel starts initialising on first use; if a cut arrives before it is ready, the tool reports it and
changes nothing.

**Why the refusal is part of the feature.** Half-working geometry is worse than a refusal: a solid that
is silently wrong corrupts snapping, selection and every later cut. The tool says it cannot do it and
changes nothing.

## Risks

| Risk | Mitigation |
|---|---|
| A shell that is not a box is refused, and users meet that often | The message names why. The ceiling is recorded in [0022](../decisions/0022-cuts-run-on-manifold.md) as the thing to supersede first if it hurts. |
| The kernel wrapper failing again, as it did in 0021 | The kernel only ever subtracts two primitive boxes, which are manifold by construction; the document-side validity checks run before it is called. |
| The mesh-to-faces conversion producing loops the document cannot hold | Non-rectangular loops and rings that are not a rectangle minus a rectangle are refused, loudly, before any entity is written. |
| WASM not ready when the first cut lands | `geometry` starts the load on first use, and the tool reports "loading" rather than cutting wrong. |
| Undo restoring the wrong faces | The inverse captures the exact entities removed, and an inverse test applies, cuts, undoes, and compares to the pre-cut document. |

## Verification

- [ ] `solid.subtract` on a recess, a through cut and a tool flush with a shell face: closed, correct volume
- [ ] The kernel mesh converts to faces with every edge shared twice and outward winding — the two
      surgery failures, now passing
- [ ] `rect.subtract` cases stay green (the ring split uses them)
- [ ] `closedShell` finds a box's six faces and refuses an open surface
- [ ] The inverse test passes for a cut, and undo restores the pre-cut document exactly
- [ ] A non-axis-aligned shell is refused with a message, and the document is unchanged
- [ ] Browser: pushing a face into a box leaves an opening, and pulling out still extrudes

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/decisions/README.md`
- [ ] `packages/{geometry,core,tools}/README.md`
- [ ] `docs/features/sketchup-core.md` (push/pull) and `docs/glossary.md` (shell)

## Result

Shipped as planned, with two deviations worth recording:

- The kernel wrapper adds its own closedness and winding validation (`solid.ts`), because kernel
  output is still untrusted geometry at the interface — that was planned in
  [0022](../decisions/0022-cuts-run-on-manifold.md) and landed there rather than in `core`.
- `conformRects` — written during the surgery round to keep shared edges subdivided alike — survives
  and is used by the conversion: the ring split's strips T-junction against the untouched faces until
  conformed. `rect.subtract` cases stay green and the shell walk is untouched.

The two assertions the surgery round could not close — every edge shared twice after a through cut,
and the volume reading — pass at the unit layer and in the browser (e2e 23/23). The "still loading"
refusal exists; a cut has yet to meet it in practice, because the kernel loads while the first click
is still happening.
