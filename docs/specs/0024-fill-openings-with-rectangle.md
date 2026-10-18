---
id: 0024
title: Infer rectangle planes from opening boundaries and restore filled faces
status: implemented
date: 2026-10-18
packages: [tools, core]
decisions: [0020, 0027]
supersedes: null
---

# 0024 — Infer rectangle planes from opening boundaries and restore filled faces

## Goal

Fix the owner's failed rectangle across a vertical opening. The preview must remain a planar,
four-sided rectangle, and explicitly tracing an opening must restore its face. This bug report
extends PR #10 before merge; the owner must verify the repaired flow.

## Plan

- Infer rectangle support from incident face boundaries (including holes) and connected edge planes,
  rather than defaulting vertex/edge targets to ground. Use both snapped corners to disambiguate.
- Align the rectangle basis to supporting edges, including rotated openings. Respect axis locks and
  reject off-plane snap targets when no supported plane exists.
- Name the active inferred plane in the status bar, per decision 0020.
- Construct all four corners from one plane; preview and commit use the same ordered perimeter.
- Pass the explicit rectangle contour with the draw command. Rebuilding a matching region may clear
  its deleted/opening marker; unrelated drawing must not refill deleted faces or kernel holes.
- Preserve constraints, snapping, atomic history, and ordinary face subdivision.

## Verification

Headless regressions: vertical/rotated holes, corner and edge targets, bare boundary edges, planar
orthogonal previews, explicit restoration with collinear boundary vertices, untouched holes, and
undo/redo of both face topology and deletion markers. Browser tests repeat the failure on a visible
vertical opening and verify one rectangular face with no diagonal document edge.
Run unit/integration tests, typecheck, browser checks and the static build. Keep port 5173 for review.

## Scope

No geometry-kernel replacement, new tool, or general face healing. Restoration is explicit and
limited to the closed contour the user deliberately draws.

## Result

- Fixed both reproduced causes: wrong plane at vertex targets and suppressed face restoration.
- Added one shared rectangle-plane inference helper for faces, hole boundaries, edges and rotated
  wire loops. Preview/commit use one planar, orthogonal four-corner contour, with no diagonal edge.
- Added explicit `fillLoop` restoration. Deleted-region records retain their boundary loops so edge
  splits update their signatures; unrelated holes and manual deletions stay suppressed.
- Seven new headless cases cover vertical/rotated openings, bare/edge targets, isolated vertices,
  split boundaries, untouched deletions and inverse history. All 70 headless tests pass.
- The browser recess-and-fill regression creates exactly one four-vertex face with no new document
  edge and verifies undo/redo. All 23 browser tests pass; typecheck and static build pass.
- No dependency additions or geometry-kernel changes. PR #10 remains open for verification of the
  newly reported fix before completing the owner's previously approved merge.
