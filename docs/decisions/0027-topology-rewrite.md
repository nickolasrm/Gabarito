---
id: 0027
title: Planar arrangements and general solid sweeps
status: accepted
date: 2026-10-17
tags: [geometry, core, topology, csg, rewrite]
supersedes: [0022, 0025]
specs: [0021]
---

# 0027 — Planar arrangements and general solid sweeps

## Decision

Vertices and undirected edges are shared. Face boundaries reference vertex IDs. A face contains
one outer contour and zero or more holes. Drawing splits intersected edges, then walks directed
half-edges in each affected plane to recover bounded regions. Nested regions become holes of their
immediate parent. Deleted faces are remembered by boundary signature until that boundary changes.

Rendering is derived from these regions. Triangles are never independent document faces. The same
triangulation is used for picking, rendering and solid input. Manifold handles union/difference on
general oriented polygon sweeps and closed shells. No box recognition or rectangle special cases.
Kernel meshes return through coplanar connected triangle groups and their boundary loops.

Core commands apply on a copy and validate before publication. History stores before/after
snapshots; failed commands do not publish partial state. IDs remain monotonic through undo.
This is the inverse mechanism for decision 0006; no second hand-written inverse algorithm.

## Consequences

The replacement removes layered cut fallbacks. Headless tests cover geometric area, incidence,
volume, invalid-command rollback, deletion and inverse operations. Picking compares actual forward
camera depth and tests occlusion at the candidate's own screen ray, without a relative depth tie.
The existing package boundaries and static hosting constraints remain.
