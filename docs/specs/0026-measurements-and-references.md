---
id: 0026
title: Add tape measurements and construction references
status: implemented
date: 2026-10-18
packages: [core, tools, scene, app, ui]
decisions: [0012, 0014, 0020, 0027]
supersedes: null
---

# 0026 — Add tape measurements and construction references

## Goal

Measure between visible snap targets, create infinite construction rulers, and draw with midpoint,
proportion and world-axis references. The owner's feature request authorizes this scope.

## Behavior

- Tape Measure (`T`) accepts click/click or press/drag/release from a vertex, edge or face, and also
  from existing rulers and axes. Display the live measurement segment and selected units at cursor.
- Completion creates one undoable ruler through the destination. Edge origins preserve edge
  direction; face and vertex origins use the measured direction. Zero distance creates nothing.
- Guides are non-geometric entities: selectable, deletable, transformable, excluded from faces and
  solids. Represent them by origin/direction, render only their camera-visible extent, snap to their
  infinite line. Never add long document edges to imitate infinity.
- World X/Y/Z axes use the same reference picking and rendering, extending in both directions.
  Their common origin snaps like a vertex. Built-in references are outside editable entities.
- Expose visible edge midpoints as exact snap points, with a distinct labeled marker. Hovering a
  face also shows its visible boundary midpoints, including holes. Visibility/occlusion rules apply.
- Rectangle previews recognize square and integer aspect ratios (2:1, 3:1, 4:1, etc., either
  orientation) near the pointer. Show a temporary diagonal and ratio; do not add a document edge
  or silently change dimensions. Typed dimensions remain exact.
- Escape, tool changes, blur and pointer cancellation clear unfinished measurement and hints.

## Plan

Extend the core entity/command API for guides and validate finite, nonzero directions. Keep guide
math and reference picking separate from surface topology. Extend the existing controller and input
routing for the tape gesture; expose cursor labels and transient inference marks through ToolView.
Update tool palette, styles, owning READMEs, spec index and changelog.

## Verification

Headless tests cover guide validation/history/transform/deletion without topology changes, infinite
reference and midpoint picking with occlusion, tape directions and both gestures, cancellation,
units and aspect hints. Browser tests cover tool routing, live cursor feedback, completion timing,
undo/redo, drawing on guides/axes, midpoint marks and non-geometric rectangle diagonals. Run full
headless/browser suites, typecheck and static build; leave port 5173 running for human review.

## Scope

No persistent dimension annotations, document rescaling, ruler ticks, new dependency or server.

## Result

- Added non-geometric Guide entities, reversible creation, selection/deletion/transforms and core
  validation. World axes/origin remain outside editable document entities, per decision 0014.
- Added tape click/click and drag/release input, live selected-unit labels, edge-parallel and
  face/vertex-direction rulers, empty-start handling, zero-length no-ops and cancellation.
- Infinite rulers render through frustum clipping. Picking includes visible exact midpoints,
  world references and ruler intersections; hovered faces expose boundary midpoint dots.
- Rectangle previews recognize integer ratios within 0.02, drawing a transient diagonal and label
  while preserving actual dimensions. Real topology never receives the diagonal or virtual rulers.
- All 93 headless tests and 32 browser tests pass; typecheck/static build pass. Chromium visual
  review confirms cursor labels, face midpoint hints and dashed rulers, with no runtime errors.
- No dependencies added. Preview remains at port 5173; merge waits for owner verification.
