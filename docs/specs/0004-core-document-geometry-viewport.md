---
id: 0004
title: Core document, geometry, and viewport slice
status: implemented
date: 2026-10-17
packages: [core, geometry, scene, app, web]
decisions: [0003, 0004, 0006, 0008, 0011, 0013]
supersedes: null
---

# 0004 — Core document, geometry, and viewport slice

## Goal

Stand up the headless document model, the geometry primitives it needs, and a WebGL viewport that
renders the document. After this spec, a document can be built programmatically, changed through
commands with working undo, and seen on screen — with no tool interaction yet.

## Why now

Everything else in this milestone is built on these three: tools emit commands into the document,
and the document is only meaningful if it can be drawn. Doing this first also exercises the
boundary rules ([decision 0004](../decisions/0004-repository-layout.md)) while the code is small.

## Scope

**In scope**

- `packages/geometry`: vectors, planes, rays, segments, polygons, triangulation, extrusion, rotation,
  bounds, and named tolerances. Pure, headless, no `three`.
- `packages/core`: entity types, the document store, the command set with inverses, the undo/redo
  stack, selection, and settings. Headless, no DOM, no `three`.
- `packages/scene`: the Three.js viewport (camera, grid, ground, lights), a document→scene builder,
  picking, screen/world projection, and an overlay group for in-progress previews.
- `packages/app` + `apps/web`: boot the store and viewport into a static page.
- A boundary test asserting `core` and `geometry` import neither `three` nor DOM globals.

**Out of scope**

- Tools, snapping, typed input, units UI, settings UI. Those are specs 0005–0008.
- Boolean operations and a real kernel. Extrusion only, per the interim note added to
  [decision 0011](../decisions/0011-geometry-kernel-strategy.md).
- The `.gabarito` file format, autosave, and import/export
  ([decision 0007](../decisions/0007-local-first-persistence.md)).
- Curves as exact circles: arcs and circles are tessellated ([decision 0013](../decisions/0013-curves-are-tessellated.md)).

## Plan

1. `packages/geometry` with the API listed in the package `README.md`. No dependencies.
2. `packages/core`: `types.ts` (entities), `document.ts` (state + queries), `commands.ts`
   (apply/invert pairs), `store.ts` (subscribe/transact/undo), `face-detection.ts` (closing a loop of
   edges creates a face).
3. `packages/scene`: `viewport.ts` (renderer, camera, render loop, projection), `camera.ts`
   (spherical orbit state), `build-scene.ts` (document → meshes and lines, rebuilt on change),
   `pick.ts` (ray against faces and edges).
4. `packages/app`: `boot.ts` wiring store + viewport; `apps/web`: the Vite entry and HTML shell.
5. Tests: geometry math, command inverse round-trips, loop→face detection, boundary imports.

## Design notes

The world is Z-up, in millimetres ([decision 0008](../decisions/0008-units-coordinates-precision.md)).
The viewport sets `camera.up = +Z` and runs Three.js in document coordinates, so there is no axis
conversion anywhere and picking, projection and tool maths all share one space.

The document is an entity graph of **points, edges, faces, guides, and dimensions**, with geometry
referenced by point id. That makes move and rotate cheap and correct: moving a point moves every edge
and face that references it.

Commands are plain data with an apply/invert pair. Undo stores the inverse produced at apply time, so
no full document snapshots are kept ([decision 0006](../decisions/0006-document-model-and-commands.md)).

## Risks

| Risk | Mitigation |
|---|---|
| The scene graph drifts from the document | Rebuild on a change counter; no incremental patching until profiling demands it. |
| Entity graph recursion and cycles | Faces reference points only; points reference nothing. |
| Triangulation of concave or self-intersecting loops | Ear clipping with a degenerate-input fallback; self-intersecting loops do not get a face. |
| Three.js in a Z-up world surprises tooling | One convention, documented in `scene/README.md`, no conversion anywhere else. |

## Verification

- [ ] `npm run typecheck`, `npm test`, and `npm run build` pass
- [ ] Boundary test fails if `three` is imported from `core` or `geometry`
- [ ] Command inverse tests cover every command type
- [ ] A programmatically built document renders and is pickable
- [ ] `npm run build` emits a static `dist/` with no server code

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`
- [ ] `packages/{geometry,core,scene,app,web}/README.md` public interfaces
- [ ] `docs/architecture/overview.md` if the runtime model shifts

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** `packages/geometry` (the full documented API, zero dependencies),
  `packages/core` (entity graph, commands with inverses, store with undo/redo, units, construct
  helpers, automatic face closure), `packages/scene` (viewport, camera, document-derived scene,
  analytic picking), `packages/app` + `apps/web` boot, and a boundary test asserting `geometry` is a
  leaf and `core` imports only `geometry`.
- **Deviations from the plan:**
  - **No boolean or kernel library was adopted at all.** Push/pull is pure extrusion, which needs no
    CSG. [Decision 0011](../decisions/0011-geometry-kernel-strategy.md) was closed as rejected: the
    feature set built here needs no kernel, so no spike was run.
  - The scene does **not** convert coordinates. Rather than rotating a root group, the viewport sets
    `camera.up = +Z` and runs Three.js in document space, so picking and projection need no
    conversion. This is simpler than the design note proposed and is what the code does.
  - Solids are built per face from the entity graph, not through `geometry.extrude.prism`, so faces
    stay flat-shaded.
- **Follow-up specs:** a persistence spec (nothing is saved yet).
