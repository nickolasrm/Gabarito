---
id: 0018
title: What an axis lock means, and the plane it needs
status: accepted
date: 2026-10-17
tags: [tools, input, geometry, ux]
supersedes: []
superseded_by: null
specs: [0012]
---

# 0018 — What an axis lock means, and the plane it needs

## Context

Pinning an axis with the arrow keys looked simple: project the pointer onto the locked axis and let the
tool use the result. It shipped that way and froze every tool. Two separate mistakes were behind it, and
both are the kind that get made again.

**The plane first.** The interaction point came from the ground plane, or from the face under the
pointer. A point on the ground plane has `z = 0`. Projecting it onto a locked `Z` axis therefore gives
a point at `z = 0` — a locked line of zero length, a locked rectangle of zero height. Nothing is drawn,
so the tool appears to hang. The interaction point has to come from a plane that *contains* the locked
axis; otherwise the third dimension is unreachable by construction.

**Then the meaning.** For a line, "on the axis" is right: the point has one degree of freedom. For a
rectangle it is wrong: a rectangle needs two, the shape lying in a plane that contains the axis. One
rule cannot serve both.

There is also a trap in building the plane. The obvious normal is `cross(axis, viewDirection)`. It is
perpendicular to the axis **and** to the view direction, which makes the plane *parallel* to the view —
edge-on to the camera. The pointer ray then hits it at a grazing angle or not at all, and the fallback
silently reuses the previous cursor, which looks exactly like a freeze.

## Decision

**A lock pins the interaction point to an axis for 1D tools, and pins a shape to a plane containing that
axis for 2D tools. The plane is built so it faces the camera.**

- Every tool declares `lockMode`, defaulting to `axis`:
  - `axis` — line, move, ruler, measure: the point is projected onto the locked axis through the anchor.
  - `plane` — rectangle, circle, push/pull, rotate: the point stays free inside a plane that contains
    the locked axis, so a 2D shape can be drawn on a vertical plane.
- The drawing plane becomes **lock-aware**: with a lock active it is the plane through the anchor that
  contains the locked axis, and its `u` basis vector is the locked axis, so a rectangle's first extent
  runs along it.
- The normal of that plane is the **component of the view direction perpendicular to the axis**, never
  the cross product. When the camera looks straight down the axis there is no such plane; the code falls
  back to any perpendicular rather than failing.
- A tool whose plane is genuinely different builds it itself: rotate raycasts the pointer onto the plane
  *perpendicular* to its rotation axis, because an angle is only defined in that plane.
- Locking an axis also silences axis *inference* while it is active. The user has stated the constraint;
  inference must not argue with it.

## Consequences

**Good:** every tool gains working locks on all three axes from one change, because the fix is in the
plane rather than in nine tools; the third dimension becomes reachable, which is what makes the
rectangle and circle usable for anything vertical; the edge-on trap is now written down in the module
that builds planes, so it is not rediscovered; and a lock's meaning is explicit per tool instead of
implied by whatever each tool happened to do.

**Bad:** `lockMode` is a concept every new tool must choose correctly, and a wrong choice fails quietly —
a `plane` lock on a 1D tool leaves the point free, which is permissive rather than broken, so it will not
be noticed in review. The plane is also re-derived when the lock changes mid-operation, which is more
state in a tool that already had a corner and a plane. And the rectangle's plane is still frozen at the
first click except when the lock changes, so drawing a rectangle that starts on one face and continues
over another does not re-orient.

**Neutral:** with a lock active, snapping to a vertex that lies off the lock plane can still pull the
point out of the plane. That is deliberate — a vertex is a stronger signal than the plane — and it is
visible in the preview.

## Alternatives considered

| Alternative | Why not |
|---|---|
| `cross(axis, viewDirection)` for the plane normal | Perpendicular to the axis *and* the view direction, so the plane is edge-on and the pointer never hits it. This was the shipped bug. |
| Keep the ground plane and project in 3D | Works for a line, impossible for a rectangle or circle, which need a surface to lie on. |
| A per-tool plane built by each tool | Nine copies of the same geometry, and the trap gets reintroduced in the one that is written last. |
| One universal rule: always pin the point to the axis | Makes a locked rectangle impossible; a rectangle is not a 1D operation. |
| Treat the lock as a soft preference and let inference win | The user pressed a key to state a constraint. Overriding it is the behaviour that feels broken. |

## Links

- Spec: [0012](../specs/0012-tool-interaction-fixes.md)
- Related: [0012](./0012-tool-input-model.md) (what the input layer owns),
  [0008](./0008-units-coordinates-precision.md) (the Z-up world this all happens in)
