---
id: 0029
title: Support click and drag Push/Pull gestures together
status: implemented
date: 2026-10-18
packages: [tools, app, ui]
decisions: [0012, 0027]
supersedes: null
---

# 0029 — Support click and drag Push/Pull gestures together

## Goal

Push/Pull supports click/move/click and press/drag/release simultaneously, as requested by the owner
while reviewing the tape snapping repair.

## Plan

- Reuse the tape gesture discriminator: a stationary first press/release arms the operation;
  a drag finishes on release, and a subsequent click finishes an armed operation.
- Keep one source face and extrusion axis throughout either gesture. Snaps, explicit axis locks,
  typed distances and early Enter work in both modes. Completion creates one history entry.
- Zero-depth completion is a no-op. Escape, tool changes, blur, cancellation and lost capture clear
  pending input, with no late release or native click causing a duplicate edit.
- Share press/release routing with tape rather than implementing another browser event path.
- Update tool guidance and tests that previously expected a stationary first click to cancel.

## Verification

Headless and browser regressions cover click/click, existing drags, typed click-mode distances,
reference snapping between clicks, zero-depth completion, cancellation and exact undo/redo.
Run full tests, typecheck and static build. Leave port 5173 available for owner verification.

## Result

- Tape and push/pull now share a press/release discriminator. A first stationary release arms click
  mode; a drag release or second click commits once. Native clicks cannot duplicate the edit.
- Pending click mode supports reference snapping, typed dimensions and Enter. Escape and blur also
  cancel between clicks. Zero-depth completion makes no document change.
- Headless and browser checks cover both gestures, exact history, typed completion, reference
  snaps, cancellation and zero-depth click completion; all earlier drag regressions still pass.
- All 114 headless tests and 49 browser tests pass; typecheck and static build pass.
- No new dependency or core/kernel changes. Preview remains at port 5173 for owner review.
