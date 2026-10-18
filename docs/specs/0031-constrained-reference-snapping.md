---
id: 0031
title: Align constrained edits to explicitly hovered references
status: implemented
date: 2026-10-18
packages: [tools]
decisions: [0012, 0018, 0027]
supersedes: null
---

# 0031 — Align constrained edits to explicitly hovered references

## Goal

Aimed faces must align Push/Pull just as vertices and edges do. Axis-pinned Move must also snap to
visible references without losing its pin. The owner's bug report authorizes this follow-up in PR #12.

## Plan

- Reuse the existing constrained reference resolver for both tools, naming it for axis snapping.
- An explicitly hovered visible face supplies its plane intersection with the edit axis. Remove the
  extra proximity check between the free axis point and that plane; pointer picking already
  identifies the reference. Preserve the zero-level proximity guard that prevents free-drag resets,
  source-face exclusion, visibility checks and rejection of planes parallel to the axis.
- For pinned Move, project vertex/edge/ruler reference coordinates onto the pinned axis; face
  references supply the axis/plane intersection. Preserve the other two coordinates exactly.
- Display the aimed target, reference connector and level label alongside the move preview.
  Preview and commit must use the same point. Alt bypass and typed dimensions retain priority.
- Keep both Push/Pull gestures and one-step history; do not change core topology or the kernel.

## Verification

Headless regressions cover explicitly aimed distant face planes, positive/negative axis directions,
rotated face planes, parallel rejection, pinned Move vertex/edge/face targets, preview/feedback,
Alt, typed overrides and undo/redo. Browser tests use deliberately separated faces and pinned Move
references, checking committed geometry rather than labels alone. Run full tests, typecheck and
static build; leave port 5173 running for owner review.

## Result

Renamed the existing extrusion resolver to `axis-snap.ts` and shared it with pinned Move.
Hovered face planes now provide the axis intersection without the extra free-depth proximity gate;
the zero-level proximity guard and source, visibility and parallel-plane exclusions remain.
Move preview and commit use the same constrained endpoint, with target feedback and connector.
Alt and typed values retain priority. No dependency, core or kernel changes were needed.

Validation: 122 headless tests, 54 Chromium browser tests, typecheck and static production build
pass. Added tests assert actual coordinates, positive/negative axes, rotated planes, feedback,
Alt/typed overrides and exact history. Browser regressions exercise both Push/Pull gestures and
pinned X/vertex, Y/edge and Z/face moves. Port 5173 remains available for owner verification.
