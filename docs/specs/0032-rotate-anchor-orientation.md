---
id: 0032
title: Orient rotation from an anchor and zero-angle reference
status: implemented
date: 2026-10-18
packages: [tools, ui]
decisions: [0012, 0018, 0020]
supersedes: null
---

# 0032 — Orient rotation from an anchor and zero-angle reference

## Goal

Rotate uses first click A as its fixed anchor and second click B as its zero-angle direction.
Their supporting face or boundary determines the rotation plane. Mouse movement after B previews
positive or negative rotation about A; a third click commits one edit.

## Why now

The owner requested this input sequence, including a cube top-face center-to-edge example.
The existing tool freezes its plane too early, loses exact boundary snaps and rotates its preview
before the zero-angle reference has been chosen. This request authorizes implementation.

## Scope

- Infer the plane through A and B using the existing supporting-plane resolver. Respect explicit
  arrow-axis overrides. With no geometric support, use the existing ground-parallel fallback.
- Preserve A throughout inference. Freeze the inferred plane and reference at B. A repeated A
  cannot establish a zero-angle direction. A ray parallel to the plane cannot commit stale input.
- Show the anchor/reference rays and signed angle beside the cursor. Before B, show zero rotation;
  afterward the selection preview and committed command use the same plane, anchor and angle.
- Preserve on-plane vertex/edge/midpoint snaps, Alt bypass, typed degrees (including after A),
  cancellation, axis-reset lifecycle and one-step undo/redo. Off-plane hits cannot pull the rotation
  point out of its frozen plane. Axis changes project the reference into the new plane; if the
  reference collapses, request B again.
- Update tool instructions and owning package documentation. No new dependency, transform kernel,
  new selection mode, angle snapping or protractor widget.

## Plan

1. Add headless regression tests for horizontal, vertical and tilted supporting faces, boundary
   anchors, zero at B, both signs, preview/commit/history, repeated anchors and explicit pins.
2. Reuse `drawing-plane.ts` for Rotate while choosing A/B, then freeze it. Centralize the active
   rotation plane/reference calculation in the controller so preview and commit agree.
3. Retain exact eligible hits in the active plane, add reference rays and angle feedback, and update
   guidance in `types.ts` and the UI's active status text where necessary.
4. Add browser coverage for real A/B/movement/commit on cube top and side faces, cancellation and
   typed rotation. Run the full headless/browser suites, typecheck and static build.

## Verification

Assert coordinates and history, not labels alone. Before the final click, store geometry stays
unchanged and A is fixed. At B the angle is zero; moving either side produces the appropriate sign.
After B, hovering another plane does not reorient the operation. Check the example at port 5173
and leave a PR for owner verification before merge.

## Docs

Update `CHANGELOG.md`, the specs index, tools README and UI README if its status copy changes.

## Result

Implemented with the existing supporting-plane resolver and core rotation command. A stays fixed, including a face click with an axis already pinned;
B freezes the supporting plane and zero direction. The preview remains unrotated before B, then
shows signed degrees and zero/current rays. Exact on-plane targets are retained. Axis changes
project the reference or clear it if degenerate; parallel pointer rays cannot commit stale input.
Typed degrees, Alt, cancellation and history retain their existing contracts. No new dependencies
or transform-kernel changes were needed. Tool instructions and the plane indicator match the flow.

Validation: 135 headless tests (including 13 rotation regressions), 57 Chromium browser tests,
typecheck and static production build pass. Browser cases cover cube top/side A/B input, both signs,
committed positions, exact undo/redo, cancellation after B and subsequent signed typed completion.
Pixel-based face-interior anchors use a one-degree/one-unit browser tolerance; headless coordinates
and angles use exact geometry tolerances. Port 5173 remains running for owner verification.

No deviations from the plan.
