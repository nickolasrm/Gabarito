---
id: 0021
title: Rewrite the basic modeler around shared topology
status: implemented
date: 2026-10-17
packages: [geometry, core, scene, tools, ui, app, web]
decisions: [0001, 0002, 0003, 0006, 0008, 0012, 0027]
supersedes: null
---

# 0021 — Rewrite the basic modeler around shared topology

## Goal

Replace the modeler implementation independently of its previous algorithms. Implement the owner's
seven-tool brief, fixing overlapping drawn surfaces and hidden vertex/edge picking at their roots.
The owner's rewrite request and instruction to proceed authorize this scope; merge still requires
explicit human review of the running result.

## Scope

- Shared vertices and edges; bounded planar regions become faces automatically.
- Segment intersections and T-junctions split edges. Nested closed contours partition faces into
  an inner face and an outer face with a hole, with no doubled surface.
- Select, rectangle, chained line, move, rotate, push/pull; numeric dimensions and arrow axis locks.
- Middle-button orbit, Shift+middle-button pan, wheel zoom.
- Pure document/geometry modules, transactional commands, undo/redo, static Three.js viewport.
- General polygon sweeps and closed-shell booleans using Manifold, including rotated solids.
- Visibility-aware point/edge/face picking and snapping.
- Mandatory style skill loading in AGENTS.md for every agent host.

Out of scope: lighting/woodworking implementations, plugin runtime, file migration and persistence,
curves, guides and annotation tools. No saved document format was implemented in the old runtime.
Historical specs and ADRs remain discoverable; current package READMEs describe the replacement.

## Plan

1. Replace geometry with vector/plane math, planar arrangements and a Manifold bridge.
2. Replace core with shared topology, reversible transactions and explicit validation.
3. Replace scene picking/rendering and camera interaction, then the tool state machine and shell.
4. Replace obsolete implementation-specific tests with behavior regressions and browser flows.
5. Verify typecheck, unit/integration tests, browser tests and static production build.
6. Update module docs, architecture routing and changelog, publish a review branch and PR.

## Risks

- Planar arrangements and mesh conversion must preserve holes and split boundary edges; test area,
  edge incidence and volume instead of relying on face counts alone.
- Arbitrary edits may open a shell. Refuse solid booleans on invalid shells without changing data.
- Old runtime interfaces change deliberately. No consumer outside this repository is supported.

## Verification

- Closed triangle, diagonal, nested/disjoint holes, crossing/overlapping edges and deleted faces.
- Extrude, recess, through-cut, refill and repeated edits; volume and closedness checks.
- Occluded/off-camera geometry, nearby visible vertices and edges, face holes.
- Every operation undo/redo, malformed numeric input, axis semantics and camera gestures.
- Real browser tool flows, no runtime errors, static bundle with local WASM asset.
- Owner verifies http://127.0.0.1:5173 before merge.

## Result

- Replaced all modeler runtime implementations. Retained build tooling, package boundaries, historical
  docs and the architecture boundary tests. New implementation has no rectangle-only cut path.
- Added mandatory skill loading to AGENTS.md for Codex and other agent hosts.
- Tests: 45 unit/integration tests and six Chromium browser flows; TypeScript and static build pass.
- Production browser check: local WASM loaded, no external requests, debug handle absent; drawing
  and extrusion continued after disabling the network. Inspected the rendered production UI.
- Deviations: no new dependency. Manifold supplies triangulation as well as booleans. Open flat-sheet
  patch extrusion is supported; nonplanar open shells must be repaired before push/pull.
- Limitations: no persistence, legacy data migration, or deferred circle/guide/annotation tools.
  Near-plane-crossing segments are omitted from snapping; snapshot history favors correctness over
  memory savings. Full CAD operations on arbitrary intersecting open surfaces remain outside scope.
- Human verification and merge are pending. Local review server remains on port 5173.
