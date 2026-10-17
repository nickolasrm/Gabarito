---
id: 0020
title: The drawing plane is chosen by what the pointer aims at
status: accepted
date: 2026-10-17
tags: [tools, geometry, ux, input]
supersedes: []
superseded_by: null
specs: [0015]
---

# 0020 — The drawing plane is chosen by what the pointer aims at

## Context

Every 2D tool — rectangle, circle — needs a plane before it can place the first point, and in a 3D
scene that plane is almost never obvious. It has to be inferred, and the inference is the single most
repaired piece of this repository: it was wrong four separate times, each time in a way a user found
before a test did.

The four failures, in order, because the pattern matters more than any one of them:

1. **The plane was always the ground.** A locked `Z` axis therefore could not leave `z = 0`, and a
   rectangle could not be drawn upright at all.
2. **A face under the cursor beat the geometry being pointed at.** Starting a rectangle on a vertex or
   an edge of a face reported the face, so the shape landed flat exactly where the user was aiming at
   something else.
3. **The fix for (2) overshot**: querying faces *first* meant that once any face existed under the
   cursor, an edge or vertex was never consulted, and the pick ranks faces above coplanar edges anyway.
4. **The plane was frozen at the anchor.** A second click on a vertex outside that plane projected one
   extent to zero, so the preview collapsed to a line and the rectangle was refused. And within the fix
   for that, choosing the edge *most perpendicular* to the drag zeroed the same extent from the other
   direction.

Each was repaired in isolation and the next case appeared one click later. The lesson is not which rule
is right; it is that an ad-hoc ordering had never been written down, so every fix was local.

## Decision

**The plane comes from the target, and it must contain the line from the anchor to the pointer.**

- Resolve the target with the same tolerances the snapper uses: **vertex, then edge, then face.** What
  the pointer aims at decides, and a face only decides when the face itself is the target.
- **The plane must contain the anchor-to-pointer line.** That line is the shape's diagonal, so
  containing it is what lets the shape reach the pointer; no target can then project outside the plane,
  which is what makes a collapse impossible rather than merely unlikely.
- The other axis is the candidate edge direction **closest to 45°** to that line. A diagonal
  perpendicular to an axis zeroes one extent and parallel to it zeroes the other, so 45° is the only
  healthy choice — and unlike picking a pair by iteration order it does not depend on which edge the
  document lists first.
- **A ground-level edge decides nothing on its own**, so the common case of drawing on the ground
  cannot tilt.
- While **no axis is pinned**, the plane is re-derived on every move, so it follows the geometry as the
  pointer crosses it. A pinned axis freezes it, because the user has stated the constraint.
- The active plane is **named in the status bar** (`Ground`, `Face`, `Edge`, `Edges`, `Axis Z`) so a
  wrong inference is visible rather than mysterious.

## Consequences

**Good:** a shape can always reach the pointer, so the failure mode that produced a collapsed preview
cannot recur; the rule is one sentence rather than four heuristics; the choice is deterministic and
independent of document order; and the status bar makes the inference falsifiable by the user in one
glance, which is how all four failures were actually found.

**Bad:** "what the pointer aims at" is a judgement with a tolerance, so the plane can change under the
pointer as it crosses a vertex — visible as the shape turning while dragging, which is deliberate but
surprising the first time. Re-deriving on every move costs a walk over the document's points and edges
per pointer event, which has no measured budget yet. And the rule is tuned for shapes whose two axes
come from existing geometry: with no geometry at all there is nothing to aim at, so a shape can still
only be drawn on the ground or with an axis pinned.

**Neutral:** the plane is inferable only where geometry exists, which means the tools remain unusable in
genuinely empty space. Drawing in mid-air would need an explicit plane handle, and that is a different
feature.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Always the ground plane, with an axis lock for anything else | The first four rounds of bug reports. A vertical rectangle required knowing to press a key first. |
| The plane of the face under the cursor, always | Fails the moment the user aims at an edge or a vertex deliberately, which is how a shape is placed precisely. |
| Keep the plane frozen at the first click | A target outside it collapses the shape. This was failure 4. |
| Pick the second axis most perpendicular to the drag | Zeroes one extent. Tried, measured as `0 × 2828.43 mm`, and reverted. |
| Let the user choose the plane explicitly every time | Removes the inference that makes the tool feel direct, and the status bar plus axis pins already give an escape hatch. |

## Links

- Spec: [0015](../specs/0015-tool-bug-round-two.md)
- Related: [0018](./0018-axis-lock-semantics.md) (what an axis lock means),
  [0008](./0008-units-coordinates-precision.md) (the Z-up world this happens in)
