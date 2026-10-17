---
id: 0026
title: A face holds every hole it gets, and there is no limit
status: accepted
date: 2026-10-17
tags: [core, geometry, csg, document-model]
supersedes: []
superseded_by: null
specs: [0020]
---

# 0026 — A face holds every hole it gets, and there is no limit

## Context

The fourth opening stopped working — reported by the owner as "there should not be a limit". The
limit was real and ours: the kernel-mesh conversion read a coplanar group's boundary loops as **one
outer plus at most one hole**, refusing three or more loops; and a plane can hold **several separate
regions** (two tunnel mouths' walls are coplanar and disjoint), where the one-outer reading turned a
whole region into a "hole" of its neighbour.

Two mechanics had to be understood first:

- The kernel's own `triangulate` reads its input under a **nonzero fill rule**: the first contour
  must wind counter-clockwise in the projected plane, every hole clockwise — **absolutely**, not
  "opposite the outer". A −axis face (a bottom ring) arrives with a clockwise outer and had its hole
  swallowed whole; a swallowed hole cannot tile an annulus, so the triangulation came back
  structurally wrong.
- The conversion's group of coplanar triangles is a **plane**, not a region: its boundary loops
  belong to however many regions live in that plane.

## Decision

- A coplanar group's loops are **paired by containment**, largest area first: each loop becomes a
  region's outer, or a hole of the smallest already-placed region whose rectangle spans it. A face
  holds every hole it gets; there is no limit.
- `sweepShell` normalises every contour on its own signed area before the kernel sees it — outer
  counter-clockwise, holes clockwise — and refuses a triangulation whose count cannot tile a region
  with that many holes (a swallowed hole cannot).

## Consequences

**Good:** openings nest and repeat without end — five through holes, three through one face, leave
one face with five holes and a solid of genus five, verified exact; the winding trap is normalised in
one place.

**Bad:** the containment pairing assumes a loop contained in a region's outer is one of its holes.
An island — separate material inside a hole — would be mislabeled a hole; box-minus-box sequences on
rectangular solids cannot produce one, and the moment they can, this record is the one to amend.

## Links

- Spec: [0020](../specs/0020-no-hole-limit.md)
- Related: [0023](./0023-faces-hold-holes.md) (faces with holes in the document),
  [0025](./0025-pull-is-a-union.md) (the sweep the conversion belongs to)
