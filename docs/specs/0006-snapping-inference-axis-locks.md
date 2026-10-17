---
id: 0006
title: Snapping, inference, and axis locks
status: implemented
date: 2026-10-17
packages: [tools, scene]
decisions: [0012]
supersedes: null
---

# 0006 — Snapping, inference, and axis locks

## Goal

Make the pointer land on meaningful places. After this spec, drawing and transforming snap to
endpoints, midpoints, edges, guides, intersections of those, and inferred axes — and the user can pin
an axis with the arrow keys.

## Why now

Snapping is what separates a modeling tool from a viewer: without it, no two lines ever meet and
push/pull has no closed face to work on. Every tool in
[spec 0007](./0007-drawing-and-transform-tools.md) depends on it.

## Scope

**In scope**

- An inference engine that, given a world point (or pointer ray) and an anchor, returns the best snap:
  | Priority | Snap | Source |
  |---|---|---|
  | 1 | Endpoint / vertex | points in the document, plus virtual vertices |
  | 2 | Guide intersection, edge∩guide, guide∩guide | guides and edges |
  | 3 | Midpoint | edges |
  | 4 | On edge | nearest point on an edge segment |
  | 5 | Intersection of existing edges | edge pairs |
  | 6 | On guide | nearest point on a guide line |
  | 7 | Axis lock | the pinned axis, or an inferred axis from the anchor |
  | 8 | On face | the face plane |
  | 9 | Free | the raw pointer position |
- **Virtual geometry counts**: guide lines are snappable as edges, the intersection of two guides is a
  snappable vertex, and so are guide∩edge and edge∩edge crossings. These are computed, not stored.
- **Extension inference**: snapping to the extension of an existing edge from a shared vertex.
- **Axis locking** with the arrow keys, active only while a tool operation is in progress:
  | Key | Axis | Colour |
  |---|---|---|
  | `→` | X | red |
  | `←` | Y | green |
  | `↑` | Z | blue |
  | `↓` | clear the lock (and, for push/pull, invert the direction) |
  | `Shift` + arrow | lock the opposite sign | — |
- The active snap is shown with an indicator and a text hint (`Endpoint`, `On Edge`, `On Axis Z`), and
  the locked axis is drawn as a coloured line through the anchor.
- A **snapping** toggle in settings that disables all inference except free positioning, per the
  request in [spec 0007](./0007-drawing-and-transform-tools.md).

**Out of scope**

- Tangent, perpendicular-to-face, and parallel-to-edge inference beyond axis alignment. Listed as
  follow-up.
- Snapping to rendered pixels of the viewport; inference works in document space only.
- Persistent inference history.

## Plan

1. `packages/tools/src/inference.ts`: candidate gathering per priority, with a screen-space tolerance
   converted to world units from the camera scale.
2. `packages/tools/src/axis-lock.ts`: lock state, key handling, and projecting a point onto a locked
   axis through the anchor.
3. `packages/scene`: rendering for the snap indicator (point, cross, or axis line) and the axis-lock
   guide, plus a text hint returned to the UI.
4. The tool context exposes `resolve(worldPoint) → SnapResult` so every tool uses one implementation.
5. Tests: priority ordering, tolerance behaviour, axis projection, guide intersections, toggling
   snapping off.

## Design notes

Inference is deliberately computed from the document on each pointer move rather than cached: the
documents at this scale are small, and a cache would be the first thing to go stale.

Tolerance is expressed in screen pixels and converted at query time, so snapping feels identical
whether the user is zoomed into a joint or looking at a whole building.

## Risks

| Risk | Mitigation |
|---|---|
| Snap priority fights the user's intent | Highest-priority candidate within tolerance wins, and the hint text says which one, so mistakes are visible and explicable. |
| Cost per pointer move on a large model | Bounding-box rejection per entity before distance maths; revisit with a spatial index if the budget is exceeded. |
| Axis lock feels stuck | Any tool cancel (Esc) and any tool completion clears the lock; `↓` clears it explicitly. |
| Snapping toggle half-works in some tools | The toggle is checked in one place, inside the resolver, not per tool. |

## Verification

- [ ] Each priority level has a test proving it wins over the level below
- [ ] Two crossing guides produce a snappable virtual vertex
- [ ] Arrow keys lock the axes and `↓` clears
- [ ] With snapping off, the pointer is free but axis locks still work
- [ ] The indicator and hint match the snap actually applied

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`
- [ ] `docs/glossary.md`: virtual vertex, inference, axis lock
- [ ] `packages/tools/README.md`

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** `resolveSnap` with the priority table from the plan, virtual geometry (guides
  snapped as edges; guide∩guide, edge∩guide and edge∩edge crossings as virtual vertices), extension
  inference from a shared vertex, arrow-key axis locks with `Shift` for the opposite sign and `↓` to
  clear, a snap indicator with a text hint, and the snapping toggle.
- **Deviations from the plan:** the candidate selection rule was **refined**. A flat
  distance-first ordering let an inferred axis beat a real vertex whenever the pointer sat exactly on
  the axis. Snaps to real geometry (endpoint, intersection, midpoint, edge, extension, guide) now
  always win over an inferred axis or the bare face plane; distance only orders candidates within
  those two groups. This is what the priority table intended, and it is covered by tests.
- **Follow-up specs:** tangent and perpendicular-to-face inference.
