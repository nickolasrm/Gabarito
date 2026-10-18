---
id: 0034
title: Scale selections with a bounding box and draggable handles
status: implemented
date: 2026-10-18
packages: [geometry, core, tools, scene, app, ui]
decisions: [0006, 0012, 0018]
supersedes: null
---

# 0034 — Scale selections with a bounding box and draggable handles

## Goal

Scale (`S`) surrounds selected geometry with a tight world-axis bounding box and draggable grips.
Dragging a grip resizes or stretches the selected shared vertices about the opposite grip. The owner
requested the tool and clarified that handles must distort the selection, authorizing implementation.

## Scope and behavior

- Three-dimensional bounds have corner, edge-center and face-center grips. Face grips stretch one
  dimension; edge grips stretch two independently in their plane; corner grips scale proportionally.
  The opposite grip is fixed. Bounds flat along a world axis have eight grips, and bounds with
  only one nonzero world extent have two; zero-size selections
  explain why they cannot scale. Do not pad flat bounds into artificial thickness.
- Visible grips use a fixed pixel size. Projected overlap resolves to the nearest grip; grips behind
  document surfaces or the camera cannot be grabbed. Box lines and grips are transient tool UI.
- Primary press/drag/release previews and commits once. Also support click/move/click and a typed
  positive scale factor (`2` doubles the grip's active dimensions). Live factors appear at the cursor.
- Preview never changes the store. Escape, blur, tool changes and pointer cancellation discard it.
  Selection/history changes refresh idle bounds and cancel stale active input. Navigation updates
  grip positions. Empty selections show guidance and no box. No new dependency or server feature.
- Add an atomic core scale command over selected vertices, preserving shared IDs and unselected
  vertices. Guides selected alongside geometry transform consistently; guide-only selections have
  no finite bounds. Reject nonfinite, zero or negative factors and invalid resulting topology.
- Reuse core validation/history, scene preview rendering, pointer capture and tool input conventions.
  Mirroring, collapse, oriented bounds, custom pivots and scaling from the center are outside scope.

## Plan

1. Share the point-scale formula in geometry, then add a serializable scale command and core regression tests for nonuniform scaling, fixed anchor,
   shared selection, guides, rollback, exact undo/redo and invalid input.
2. Implement bounds/grip geometry and a separate headless Scale interaction module. Integrate its
   lifecycle and factor entry into the controller without expanding existing tool state machines.
3. Extend the structural view contract with transient handles; render/dispose them in scene and
   update their screen positions with the camera. Picking stays headless in tools.
4. Route Scale through captured primary gestures. Add its toolbar shortcut, factor label, cursor
   and instructions. Dispose controller subscriptions when app unmounts.
5. Add headless and real browser regressions for handle bounds, drag and click input, stretches,
   typed factors, cancellation, history, empty/flat selections and visibility. Run all suites,
   typecheck and static build. Keep port 5173 running and open a PR for owner review.

## Docs

Update the root status, built-in feature list, owning package READMEs, the specs index and `CHANGELOG.md`. No new architectural dependency
or decision record is required; this follows the existing command/view/input boundaries.

## Result

Implemented a shared geometry scale formula, atomic core scale command, separate bounds/grip and
Scale interaction modules, disposable scene grip overlays and captured browser input. Face handles
stretch one axis, edge handles two independently and corners proportionally; opposite anchors stay
fixed. Bounds follow world axes, so tilted faces/diagonal lines retain their actual world extents.
Idle bounds refresh with selection/history. Preview is transient; one commit uses core validation
and exact snapshot history. Typed factors, cancellation and both pointer gestures work.

Gesture-origin click suppression also prevents a release from starting another tool after a
mid-drag tool switch. Controller disposal removes its new store subscription. No new dependencies
or server features were added. The documented mirroring/oriented-box/custom-pivot exclusions remain.

Validation: 154 headless tests, 63 Chromium browser tests, typecheck and static build pass.
Tests cover shared vertices, fixed anchors, independent factors, rulers, invalid input/topology
rollback, flat/line bounds, occlusion, stale rays, camera updates, cancellation, tool switching,
typed factors and exact undo/redo. Port 5173 remains running for owner verification before merge.
No deviations from the plan.
