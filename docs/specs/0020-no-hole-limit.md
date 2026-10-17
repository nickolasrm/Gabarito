---
id: 0020
title: No limit on holes
status: implemented
date: 2026-10-17
packages: [core, geometry, scene]
decisions: [0026]
supersedes: null
---

# 0020 — No limit on holes

## Goal

Openings nest and repeat without end: a face holds every hole it gets, however many, and the second
hole in a face works like the first.

## Why now

The owner reported the fourth opening stopping, and said there should not be a limit. There was one,
and it was ours: the kernel-mesh conversion read a coplanar group's boundary loops as one outer plus
at most one hole, refusing three loops — the second opening in any face — and mislabeling a whole
separate region as a "hole" of its coplanar neighbour. Two planes up, the same shape of bug sat in
the kernel triangulator's input, whose winding rule nobody had written down
([decision 0026](../decisions/0026-faces-hold-every-hole.md)).

## Scope

**In scope**

- The conversion pairs a coplanar group's loops **by containment** (largest first, tightest host):
  each loop is a region's outer or a hole of the region that spans it. No count limit anywhere.
- `sweepShell` normalises each contour's winding on its own signed area — outer counter-clockwise,
  holes clockwise in the projection — and refuses a triangulation whose count cannot tile the region.
- Tests: several openings through one face, nested openings, and the winding trap at both faces of
  the solid.

**Out of scope**

- Islands (separate material inside a hole): box-minus-box sequences on rectangular solids cannot
  produce one; the containment pairing would mislabel it, and [0026](../decisions/0026-faces-hold-every-hole.md)
  is the record to amend when that changes.

## Result

Shipped: five through holes, three through one face, leave **one face with five holes** and a solid
of genus five (χ = −8, exact); 0 edge problems; 117 unit tests, 23 e2e, typecheck clean. The winding
trap is normalised in `triangulateFace` and written down in [0026](../decisions/0026-faces-hold-every-hole.md).
