---
id: 0023
title: Add precise modeling input and target feedback
status: implemented
date: 2026-10-18
packages: [tools, scene, app, ui]
decisions: [0012, 0027]
supersedes: null
---

# 0023 — Add precise modeling input and target feedback

## Goal

Implement the owner's four interaction requests: precise drawing cursors, hold/release push/pull,
visible vertex/edge snap feedback, and face-boundary selection on double-click with connected
selection reserved for triple-click. This scope is authorized by the owner's implementation request.

## Plan

- Use a crosshair for modeling tools and the default pointer for Select.
- Push/pull starts on primary pointer down, previews while held, and commits once on release.
  Capture the pointer so release outside the canvas completes reliably. Escape, pointer cancellation,
  lost capture and window blur cancel. A stationary press/release is a no-op.
- Typed dimensions and axis locks remain usable during a held gesture. Enter may commit early;
  subsequent release must not create another operation. Invalid release cancels and reports its error.
- Render visible snap targets at their actual world positions: a vertex square or edge diamond,
  label, and edge highlight. Face hover highlights the actual selectable face. Use the same picking
  result and constraints as the tool; hide stale feedback on leave/cancel/navigation/model changes.
- Pass native click counts through app. One selects the face; two select only that face and the
  vertices/edges of all its boundary loops; three select the entire connected component. Shift-single
  keeps its toggle behavior and Shift-multiple adds the expanded selection.
- Keep hover and drag previews transient; geometry and selection remain command/store operations.

## Verification

- Headless tests for hold/release lifecycle, exact typed distance, one history entry, cancellation,
  invalid input, snap feedback under constraints, and boundary versus connected selection with holes.
- Browser tests for cursor changes, actual mouse hold/release, release outside canvas, no-op clicks,
  cancellation, numeric/axis input, marker position/clearing and click-count selection on a solid.
- Adapt existing push/pull browser flows to the new input contract; retain all geometry regressions.
- Run typecheck, unit/integration suite, browser suite and static build. Keep port 5173 for review.

## Scope

No geometry-kernel changes, new tools, dependencies, or new snap modes. Existing visible picking
and tolerance define eligible targets. Update module READMEs, UI hints, changelog and this index.
Human verification is required before merge.

## Result

- Crosshair cursors follow tool state, overriding the inline default installed by OrbitControls.
- Added captured primary-pointer push/pull gestures, cancellation and one-step history. Typed input
  commits on release; Enter may commit before release without a duplicate operation.
- Added transient vertex/edge markers with labels and edge highlighting, plus face hover tint. They
  use the same visible candidate and effective constraints as the controller. Single-face selection
  no longer renders its vertices as selected unless those vertex IDs are explicitly selected.
- Extracted face-boundary/connected selection into tools/selection.ts and browser event routing into
  app/input.ts; no geometry-kernel changes or new dependencies.
- 63 headless tests pass. All 22 browser cases verified (21 in the full run, then the corrected
  lost-capture timing case separately). TypeScript and static build pass. CI reruns the full suite.
- Updated input hints and module contracts. Human verification remains pending on port 5173.
