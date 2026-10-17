---
id: 0015
title: Fix the tool bugs reported from real use, second round
status: implemented
date: 2026-10-17
packages: [core, scene, tools]
decisions: []
supersedes: null
---

# 0015 — Fix the tool bugs reported from real use, second round

## Goal

Five defects in the drawing and selection path:

1. Face detection missed a closed polygon when earlier dangling geometry was present.
2. The line tool ignored the height axis unless `↑` was pressed.
3. The line tool kept chaining after an edge closed a face.
4. With one rectangle drawn inside another, every tool picked the **outer** face.
5. The selection highlight was drawn behind the model.

## Why now

Reported by the owner. Item 4 blocks real modelling — a face inside a face is how anyone draws a
floor with a stairwell, or a bench top with a hole — and item 5 makes selection hard to trust
visually. Item 2 is the difference between a 2D drawing tool and a 3D one.

## Scope

**In scope**

- Loop searching, line chaining, axis inference, face picking, and the selection overlay.
- Tests for each: unit where the maths is headless, browser where the interaction is.

**Out of scope**

- Making the pushed solid cut a hole in the parent face. Nested faces remain stacked coplanar faces;
  only the picking order is fixed here. Booleans are still deferred
  ([decision 0011](../decisions/0011-geometry-kernel-strategy.md)).
- Reference counting between overlapping edges and faces.
- Touching the vendored skills or the agent rules.

## Plan

1. Reproduce all five in a real browser before changing anything, including a screenshot for item 5.
2. Replace the capped depth-first loop search with a breadth-first shortest cycle.
3. Infer an axis from the pointer ray and gate it by screen distance.
4. Stop chaining when the edge just drawn closed a face.
5. Break picking ties between coplanar faces by area.
6. Lift the interaction overlays out of the depth test, and stop drawing a black edge under a
   selected one.
7. Cover each fix with a test, then verify in the browser.

## Design notes

**The loop search was not the real cause of item 1.** At the core level a hand-drawn 24-gon had always
closed; the earlier `MAX_LOOP_POINTS` cap did reject long polygons, and that is fixed by the
breadth-first rewrite, but the failure the owner hit came from somewhere else. Instrumenting the
inference showed the actual mechanism: each click was being pulled onto an inferred axis, moving
vertices up to 623 mm from where they were clicked, so the later closing click no longer landed on the
vertex it was meant to and the loop stayed open. Two changes reduce that: the axis gate now measures
**screen** distance rather than the 3D distance between the pointer ray and the axis line, and endpoints
snap from 40% further away than other candidates, so a closing click a few pixels short still closes.

**The axis gate had to be screen-space.** A line that is nearly parallel to the view can be hundreds of
millimetres from the pointer in 3D while looking far away on screen, and the reverse. Measuring
`ray.closestPointsToSegment` against the world tolerance therefore snapped clicks the user aimed
elsewhere — which is what silently broke the owner's polygons.

**Stacked coplanar faces tie on distance, so distance cannot decide.** Both faces intersect the picking
ray at the same point. The smallest face is what the user aimed at, so area breaks the tie. This is one
rule in `pick`, and every tool that picks — select, move, push/pull — inherits it.

**The overlays are interface, not geometry.** The marquee was built in the view plane through the
anchor, so anything nearer the camera occluded it. Overlays now render with the depth test off and a
high render order. Selected edges were also drawn twice: a black base edge and the blue selection edge
at the same depth, with the black winning. The base pass now skips them.

## Risks

| Risk | Mitigation |
|---|---|
| Axis inference still binds when the user aimed elsewhere, on a polygon whose vertices happen to line up on screen | Endpoint tolerance is wider than the axis gate, so a real vertex wins; snapping can be switched off entirely in settings. |
| Picking by area changes what a click selects on geometry where a small face overlaps a large one unexpectedly | The rule only applies when the candidates tie on distance, which means they are coplanar; the smaller face is inside the larger. |
| Overlays drawn with no depth test show through the model while drawing | Accepted for the in-progress preview and the marquee: seeing your own rubber band matters more than occluding it. Committed geometry is unaffected. |
| The wider endpoint tolerance welds two distinct-but-close vertices | It is 40% wider than the general snap, not larger than the screen-space distance a user can aim within; the document weld tolerance is unchanged. |

## Verification

- [x] A hand-drawn 24-gon closes a face; a polygon reusing a dangling edge's vertex closes a face
- [x] The line tool follows the blue axis with no key held, and does not bind to an axis the pointer is not near
- [x] A closing click a few pixels short of the vertex still closes the loop
- [x] Drawing stops once an edge closes a face
- [x] Picking a nested pair selects the inner face, and the outer one outside it
- [x] The marquee draws over a solid, and a selected face shows its blue outline (screenshots)
- [x] 92 unit tests and 19 browser tests pass, and all six earlier fixes still pass
- [x] Hovering a vertex or an edge of a face reports `Face`, and empty space reports `Ground`
- [x] A selected vertex draws a highlight (screenshot)
- [x] The line tool snaps to a vertex 2000 above the drawing plane (browser: `Endpoint`, edge z = 2000)
- [x] A diagonal in a square creates both triangles (browser: 7 faces to 9)
- [x] A rectangle across the corner of an L of lines lies in the plane through both (browser: y span 0,
  z span 1200, plane reported as `Edges`)
- [x] Aiming at an upright edge over a ground face reports `Edges`, and aiming at the face reports
  `Face`, with a ground-level vertex still reporting `Face`
- [x] A rectangle drawn between two vertices that no remaining face contains creates a face (browser:
  a cube with a corner deleted, 3 faces to 4)

## Addendum: what the owner's verification found

Four further rounds of clicking, each of which found a different failure in the *same* inference: the
plane a 2D tool draws on. In order: the plane did not follow the pointer's height; a face under the
cursor beat the edge being aimed at; fixing that made faces never consulted at all; and the plane frozen
at the anchor collapsed a rectangle to a line, which the first attempt at a fix reproduced from the
other direction by choosing the edge perpendicular to the drag.

All four are fixed, and the rule they add up to is recorded in
[decision 0020](../decisions/0020-drawing-plane-inference.md) rather than left here: the plane comes from
what the pointer aims at, and it must contain the anchor-to-pointer line. Two smaller gaps from the same
round are fixed alongside it — a selected vertex now draws a highlight, and one edge that closes several
loops now creates a face for each.

Pulling a small face to make a hole is **not** a bug: it is a boolean subtract, which
[decision 0019](../decisions/0019-mesh-csg-kernel.md) has now adopted a kernel for, with the plan in
[spec 0016](./0016-cut-holes-with-push-pull.md).

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** the breadth-first loop search, ray-based axis inference with a screen-space gate, a
  wider endpoint snap, chaining that stops at a face, area tie-breaking in picking, and overlay/edge
  fixes in the scene.
- **Deviations from the plan:** nothing was cut. Item 1's root cause turned out to be axis inference
  rather than the loop search, and both were fixed; the plan had assumed only the loop search.
- **Follow-up specs:** a real boolean cut, so a face inside a face becomes a hole rather than two
  stacked faces. This is the one thing the owner asked for that this spec does not do, and it needs a
  kernel decision first ([0011](../decisions/0011-geometry-kernel-strategy.md)).
