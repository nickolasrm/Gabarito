---
id: 0036
title: Draw circles from a center and radius
status: implemented
date: 2026-10-18
packages: [geometry, tools, app, ui]
decisions: [0012, 0013, 0018, 0020]
supersedes: null
---

# 0036 — Draw circles from a center and radius

## Goal

Circle (`C`) draws a closed planar circle approximation from a center and radius. Typed lengths
measure the radius. The owner's explicit request authorizes this implementation.

## Plan

- Reuse drawing-plane inference, exact geometry snaps, face-reference hints, Alt bypass, axis-plane
  overrides, units and numeric entry. Click the center, move for a live preview, then click or type
  a positive radius and Enter. Freeze the support plane at the center except for explicit overrides.
- Following decision 0013, create a regular edge loop and face, 24 segments by default. Expose a
  small Circle-only segment setting (3–256), applied at creation without changing existing geometry.
  The radius direction determines the first perimeter vertex; a stationary pointer uses the plane U.
- A shared pure geometry helper generates preview and commit points. Send one existing draw command
  with the closed fill loop so circles partition parent surfaces and fill deliberately retraced holes.
- Preserve cancellation, one-step undo/redo, visibility rules, static hosting and module boundaries.
  No analytic curve entities, arcs, extra dependency or drawing history rewrite.

## Verification and docs

Test exact radii, segment settings, ground/vertical/tilted planes, snapping/Alt, typed units, invalid
input, parent-face partitioning, extrusion and history. Add browser tests for real center/radius
input, hints, previews and cancellation. Run full suites, typecheck and static build; update owning
READMEs, tool guidance, root status, changelog and specs index. Keep port 5173 running and leave a
PR for human verification before merge.

## Result

Implemented a pure `circlePoints` helper and center/radius input using existing plane and snap
resolvers. The plane freezes at the center; explicit locks can override it. Typed radii use display
units. Creation emits one existing draw/fillLoop command, partitioning surfaces and preserving
extrusion/history behavior. Circle-only segment entry defaults to 24, accepts 3–256, supports normal
partial typing, and changes only future creations. No analytic curve entity or dependency was added.

Validation: full suite passes with 176 headless tests and 69 Chromium browser tests. After the final
setting-field UI adjustment, all six Circle/Offset browser cases were rerun and passed. Typecheck
and static build pass. Coverage includes exact radii, settings/units, ground/vertical/tilted planes,
face-center hints, Alt, frozen-plane snapping, parent cuts, extrusion, cancellation and exact history.
Port 5173 remains running for owner verification. No deviations from the plan.
