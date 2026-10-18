---
id: 0025
title: Preserve surfaces when deleting coplanar dividers
status: implemented
date: 2026-10-18
packages: [core]
decisions: [0027]
supersedes: null
---

# 0025 — Preserve surfaces when deleting coplanar dividers

## Goal

Deleting an edge between coplanar faces merges their surface instead of deleting both faces.
The owner's bug report authorizes this follow-up to PR #10, pending local human verification.

## Plan

- Handle deletion once in core, shared by keyboard and toolbar callers.
- Union only face groups connected through deleted coplanar dividers, using the existing kernel.
- Preserve unselected sketch edges, unrelated faces and holes, and atomic undo/redo.
- Keep explicit face/vertex deletion and outer-boundary/noncoplanar edge removal semantics.
- A mixed deletion that removes the merged surface's boundary must not recreate that boundary.

## Verification

Headless tests cover inset contours, multiple dividers, holes, opposite winding, mixed boundary
removal, noncoplanar edges, explicit deletion and history. A browser regression repeats rectangle
fill followed by deleting its border on a vertical recess. Run unit tests, typecheck, browser tests
and static build. Keep the preview at port 5173 for owner review.

## Scope

No new tool, dependency or automatic healing of unrelated deleted regions.

## Result

- Added a focused core deletion module; keyboard and toolbar share the same command path.
- Faces connected across deleted coplanar dividers union with consistent winding. Other holes and
  unselected edges remain. Boundary/noncoplanar and explicit face/vertex deletion remain destructive.
- Six headless regressions and one browser recess/fill/delete regression pass, including undo/redo.
- All 76 headless tests, 24 browser tests, typecheck and static build pass. No new dependency.
- Preview remains available at port 5173. PR #10 awaits owner verification before merge.
