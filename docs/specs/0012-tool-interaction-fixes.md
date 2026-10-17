---
id: 0012
title: Fix six tool interaction bugs
status: implemented
date: 2026-10-17
packages: [tools, scene, core, app]
decisions: [0018]
supersedes: null
---

# 0012 — Fix six tool interaction bugs

## Goal

Six reported defects in the modeler, all in the path between the pointer and the document:

1. No cursor feedback — the canvas never changed to a drawing cursor.
2. The line tool did not close a face when three lines formed a triangle.
3. The rectangle tool could not draw on the height axis; it was stuck in the width/depth plane.
4. The move tool showed connector lines instead of the geometry following the cursor.
5. Pinning an axis froze every tool: clicks stopped producing geometry.
6. Push/pull did nothing when dragging.

## Why now

Reported by the owner from real use. Five of the six are in the interaction layer that
[spec 0007](./0007-drawing-and-transform-tools.md) and [spec 0006](./0006-snapping-inference-axis-locks.md)
declared finished, so either the specs were wrong or the tests were too weak to notice. Both turned out
to be true.

## Scope

**In scope**

- A per-tool CSS cursor, set by the viewport when the active tool changes.
- Face closure from a triangle.
- Axis locking that works on all three axes, for every tool.
- A move preview that shows the geometry, not just where the vertices are going.
- Push/pull by dragging.

**Out of scope**

- Copy and array modifiers on move; erase, offset and follow-me.
- Snapping to a face's interior beyond the drawing plane.
- Any change to the document format or the command set, except for `buildExtrusion` accepting an
  optional direction (the axis a pull follows when one is pinned).

## Plan

1. Add `cursor` to the tool contract, `Viewport.setCursor`, and wire it in `app`.
2. Fix the loop search in `face-detection.ts`.
3. Make the drawing plane lock-aware, and give each tool a `lockMode`.
4. Preview the moved geometry as a ghost in the move tool.
5. Give push/pull its own plane, one that contains the pull direction.
6. Cover every fix with a unit test and a browser test.

## Design notes

**The freeze had a single root cause.** The drawing plane was always the ground plane (or the face
under the pointer). A point locked to `Z` on the ground plane has `z = 0` forever, so the locked line
had no length and the locked rectangle had no height. Making the plane *contain* the locked axis is the
fix, and it repairs every tool at once. The per-tool meaning of a lock is recorded in
[decision 0018](../decisions/0018-axis-lock-semantics.md).

**Push/pull could never work by dragging.** The drag distance was measured from the cursor's point on
the *face plane*, and every point on the face plane is at distance zero along the face normal. The
number was structurally always 0. The tool now raycasts the pointer onto a plane that contains the pull
direction, which is what the drag needs.

**Why the tests missed it.** The existing push/pull test typed a distance and pressed Enter. That is a
real path, and it passed, which made the tool look finished while the drag path was unreachable. The
same is true of the lock tests: they asserted that `axisKey` was set, not that the interaction still
produced geometry. Both suites now assert the geometry a user would see.

## Risks

| Risk | Mitigation |
|---|---|
| A lock now changes the drawing plane mid-operation | The rectangle and circle re-derive their plane when the lock changes, tested both ways. |
| The plane that contains the axis can be edge-on to the camera | Its normal is the view direction's component perpendicular to the axis; the cross product would be edge-on, which is exactly the bug that was fixed. |
| `lockMode` is a new concept tools must get right | Defaulted to `axis`; only the four 2D-shape tools override it, and each is tested. |
| Dragging push/pull past the camera gives a runaway distance | Distance is a signed projection onto the pull axis; a large drag gives a large solid, which is what the user asked for. Typed values remain exact. |

## Verification

- [x] Cursor: `default` for select, `crosshair` for drawing tools, `ns-resize` for push/pull
- [x] Triangle of three lines yields one face, three edges, three points
- [x] A pinned `Z` yields a vertical rectangle and a vertical edge
- [x] Moving previews a filled ghost of the geometry, and `Esc` restores the original positions
- [x] Push/pull extrudes to a closed six-face solid by dragging alone
- [x] 82 unit tests and 16 browser tests pass

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** all six fixes, plus [decision 0018](../decisions/0018-axis-lock-semantics.md) and
  seven new unit tests and five new browser tests. `packages/tools/src/planes.ts` now owns the rule for
  building a plane around an axis.
- **Deviations from the plan:** none. `buildExtrusion` gained an optional direction, which the scope
  allowed for.
- **Follow-up specs:** the cursor is per tool but not per *operation* — a grab cursor while a move is in
  flight would be better. Not requested.
