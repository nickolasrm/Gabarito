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

## Addendum: what the owner's verification found

Three things came back from clicking through the change. Two were real gaps in this work; one is not a
bug at all.

**The drawing plane followed the pick order, not the geometry.** Hovering over the top face of a solid
reported the plane as `Ground` whenever the pointer was near one of that face's vertices or edges,
because the general pick prefers a point or an edge and the plane code only accepted a face hit. So the
shape landed on the ground even with a face right under the pointer — which is what "the line and
rectangle tools cannot draw on a different plane" actually was. Fixed with a faces-only raycast plus an
incident-face lookup, so clicking a vertex or an edge of a face draws on that face. The status bar now
names the plane (`Ground`, `Face`, `Axis Z`) so this is visible instead of mysterious, which is what
made the behaviour look like a mystery in the first place.

**A selected vertex had no highlight.** Picking one worked — the document held the point, and the status
bar said `1 point selected` — but the selection layer drew only faces and edges, so the click looked
like it had gone nowhere. Selected points now draw as a larger dot.

**Pulling a small face to make a hole is not a bug.** It is a boolean subtract, and it is exactly what
[decision 0011](../decisions/0011-geometry-kernel-strategy.md) deferred: extrusion only, no kernel.
It needs its own spec and its own decision, not a ride-along on a bug fix. Recorded as the next
follow-up rather than quietly skipped.

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
