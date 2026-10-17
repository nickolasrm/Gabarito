---
id: 0023
title: A document face can hold holes
status: accepted
date: 2026-10-17
tags: [core, geometry, scene, document-model]
supersedes: []
superseded_by: null
specs: [0017]
---

# 0023 — A document face can hold holes

## Context

The cut works ([0022](./0022-cuts-run-on-manifold.md)), but the face around an opening is stored as
four rectangle strips — because a face was a single loop and could not hold a hole. The strips are
real edges in the document, so the border of an opening reads as four faces with seams between them.
The product this is inspired by keeps the border as **one face with a hole**, and the difference is
visible on every opening: a face that selects, paints and pushes as one, instead of four patches.

The constraint came from [0021](./0021-straight-cuts-by-face-surgery.md)'s narrow route: "a rectangle
minus a rectangle is at most four rectangles and never a hole, which is what makes this expressible".
That reasoning died with the surgery route. The kernel mesh already returns the ring as one region
with two boundary loops; the conversion was splitting it for the document's sake, not the kernel's.

## Decision

**`FaceEntity` grows an optional `holes`: a list of ordered, closed loops of point ids, each inside
the outer loop.**

- The entity kind stays; `holes` is optional and absent on every face that has none, so existing
  documents load unchanged and no version bump is forced by the reader.
- Hole boundaries are ordinary edges: each adjacent pair inside a hole loop is an edge entity, shared
  by the ring face and whatever lies on the other side. Nothing new about edges.
- `core` treats every loop of a face as using its edges and points — removal closure, picking
  support, selection all see the hole.
- `scene` triangulates a face with holes as one region (contour plus holes), so the border renders
  seamless and picking excludes the hole's area.
- The cut conversion stops splitting rings: a group with one boundary loop is a face, a group with
  two is a face with a hole, both taken straight from the kernel mesh with the kernel's winding.
  With rings whole, `conformRects` and the ring split in `rect.subtract` have no caller and are
  removed.
- Push/pull refuses a face that has holes — the opening's floor and walls are the faces to push.

## Consequences

**Good:** an opening's border is one face — selection, rendering and the next cut see it as the user
does; the conversion shrinks (no strip arithmetic, no conforming pass); the visible seams disappear.

**Bad:** two loop representations to keep honest (outer plus holes) in every place that walks a
face; the renderer must triangulate contours with holes; and a face is no longer always a simple
polygon, so anything that assumed one must say so or check.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep strips, hide the seams at render time | The model would still say four faces; selection, painting and push/pull would disagree with what the user sees. |
| Merge adjacent coplanar strips in `core` after the cut | Same model, more arithmetic — the kernel already returns the merged region. |
| Store holes as a second entity kind | A hole is not an entity; it is part of the face that holds it. |

## Links

- Spec: [0017](../specs/0017-faces-hold-holes.md)
- Related: [0022](./0022-cuts-run-on-manifold.md) (the cut the conversion belongs to),
  [0021](./0021-straight-cuts-by-face-surgery.md) (where the single-loop constraint came from)
