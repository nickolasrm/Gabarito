---
id: 0022
title: Continue push/pull on raised open sheets
status: implemented
date: 2026-10-18
packages: [core, geometry]
decisions: [0027]
supersedes: null
---

# 0022 — Continue push/pull on raised open sheets

## Goal

Fix the owner's reported sequence: draw nested rectangles on a flat sheet, raise the inner patch,
draw another rectangle on its top, then push or pull that smaller face. The repair is authorized by
the bug report and continues PR #9; human verification is still required before merge.

## Root cause

The open-sheet path rejects every nonplanar connected component. Its own first extrusion makes that
component nonplanar, so the next operation is refused. The previous test stopped after the first pull.

## Plan

- Generalize the existing surface sweep to connected open sheets; do not invent a closed solid.
- Combine coplanar swept and existing surfaces using Manifold's oriented 2D winding rules. Opposing
  wall regions cancel when retracting a face; same-direction regions merge when extending it.
- Conform shared edges after replacement, preserving face boundaries and undo/redo transactions.
- Keep closed-solid union/difference on the existing kernel path, with all validity checks intact.
- Add the exact multistep regression in both directions, repeated edits, whole-top retraction,
  rotated sheets and browser interaction. Preserve outer-sheet boundary and eliminate doubled faces.

## Verification

Run typecheck, unit/integration tests, browser suite and static build. Confirm failed tangent sweeps
still roll back atomically. Human review repeats the reported sequence on port 5173.

## Scope

No new dependencies or tools. This repairs face extrusion on open surfaces; it does not introduce
solid-volume semantics for sheets or general intersection trimming against unrelated surfaces.

## Result

- Removed the flat-sheet-only restriction. Open connected sheets use the existing patch boundary
  sweep after any number of extrusions. Closed-solid operations retain their kernel validation.
- Added `mergeCoplanar`, using Manifold Positive/Negative CrossSection fill rules, and reused the
  existing shared-edge conformity step without triggering automatic face creation.
- Eight new headless cases: nested top pushes/pulls, repeated refill, whole-top extend/retract,
  return to flat, rotated sheets and rollback of a tangent sweep. All 53 headless tests pass.
- Four browser cases reproduce the reported sequence with mouse and numeric input, in both
  directions, including undo/redo. All ten browser tests, typecheck and static build pass.
- No added dependencies. Human verification remains pending on PR #9 and port 5173.
