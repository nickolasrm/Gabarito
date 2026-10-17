---
id: 0011
title: Geometry kernel — adopt first, build later
status: proposed
date: 2026-10-17
tags: [geometry, csg, kernel, performance]
supersedes: []
superseded_by: null
specs: [0003]
---

# 0011 — Geometry kernel: adopt first, build later

> **Status: proposed.** This record is deliberately unsettled. It states the intended direction and
> the spike that must pass before it is accepted. Its purpose is to stop agents from each reaching
> their own conclusion about how solids work.

## Context

A SketchUp-like modeler needs more than triangle rendering: faces bounded by edges, extrude along a
normal, push/pull, offset, intersection between solids, and a notion of inside/outside. Walkthrough
models tolerate triangle soup; a woodworking cut list and a lighting study do not.

Three.js is a renderer, not a CAD kernel ([0003](./0003-rendering-engine-threejs.md)). It has no
solid model, no robust boolean operations, and no topology guarantees.

The options are broadly: adopt an existing mesh-based boolean library, adopt a WASM geometry kernel,
or build our own. The last option is a multi-year project on its own, and this repository should not
spend its first year on a kernel.

## Decision (proposed)

Start with a **mesh-based approach over our own lightweight topology**, not a full B-rep kernel:

1. **`packages/geometry` owns a minimal half-edge-ish topology**: vertices, edges, faces, with
   face loops and adjacency. Enough to answer "which faces share this edge?" and "is this solid
   closed?", which push/pull and inference need.
2. **Adopt a mature mesh boolean library** for union/difference/intersection rather than writing CSG,
   chosen by the spike below. Candidate space: `three-bvh-csg`-style libraries, `manifold` (WASM),
   or `csg.js` descendants.
3. **Keep the kernel behind an interface.** `geometry` exposes operations (`extrude`, `pushPull`,
   `boolean`, `offset`, `slice`) over its own types. No consumer imports the boolean library directly,
   so replacing it is contained.
4. **Explicit tolerance policy** per operation, as required by
   [0008](./0008-units-coordinates-precision.md). Mesh booleans are not exact; the interface must say
   what accuracy it promises.
5. **Migration path reserved for WASM.** A WASM kernel (for example `manifold` compiled to WASM, or
   OpenCascade) is the likely end state for robustness. The static-build requirement
   ([0001](./0001-static-hosting-github-pages.md)) is compatible with WASM, so choosing it later is a
   swap behind the same interface, not a rewrite — provided the interface is genuinely opaque.

**Prerequisite:** the spike in [`../specs/0003-geometry-kernel-spike.md`](../specs/0003-geometry-kernel-spike.md)
must run before this record is accepted. It compares at least two candidates on: bundle size,
robustness on coplanar and near-degenerate cases, permission/licensing, WASM availability, and
maintenance activity — measured against a push/pull-on-a-box and a wall-with-a-door-opening case.

## Consequences (expected, to be confirmed by the spike)

**Good:** solid operations arrive in weeks instead of years; the interface keeps the kernel
swappable; mesh booleans are fast enough for building-scale models; no heavy build toolchain for a
WASM kernel at the start.

**Bad:** mesh-based booleans are not robust — coplanar faces and near-degenerate geometry will
produce visible artefacts and need tolerance and cleanup work; "solid" is an approximation, so
curved surfaces are tessellated and exact circles are lossy; a half-edge structure of our own is
real code to write and test, and getting it wrong is expensive; adopting a library brings a licence
and maintenance dependency that must be checked before it becomes load-bearing; if the interface
leaks library types, the promised swap is fiction.

**Neutral:** the choice between a JS library and a WASM kernel will likely be revisited once
lighting and house-building need thin walls and precise openings — the decision record is written so
that revisit is a supersede, not a rewrite.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Build a B-rep kernel from scratch | Years of work, and not the product's differentiator. |
| Use Three.js `BufferGeometry` as the model | Triangle soup with no topology; push/pull and cut lists become guesswork. |
| Adopt OpenCascade.js immediately | Powerful and exact, but a large WASM payload and a steep API; premature before the product has users. |
| Use `manifold` (WASM) from the start | Strong candidate, plausibly the end state; the spike exists to decide whether to skip the intermediate step. |
| Keep everything as 2D plans plus extrusion | Might satisfy the house-building domain, but not woodworking joinery or free modeling. |
| Delegate booleans to the renderer | Renderers do not do robust CSG. |

## Links

- Spike: [`../specs/0003-geometry-kernel-spike.md`](../specs/0003-geometry-kernel-spike.md)
- Related: [0003](./0003-rendering-engine-threejs.md), [0008](./0008-units-coordinates-precision.md),
  [0010](./0010-testing-strategy.md), [0006](./0006-document-model-and-commands.md)
