---
id: 0003
title: Three.js as the rendering layer
status: accepted
date: 2026-10-17
tags: [rendering, webgl, three, performance]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0003 — Three.js as the rendering layer

## Context

A modeling tool needs a WebGL layer for: a large but not extreme number of triangles, per-entity
picking and highlighting, axis/grid helpers, transparent and double-sided faces, sky and shadow
preview, and — later — lighting visualisation, which is the primary reason the renderer choice is
recorded separately from the language choice.

The renderer must not become the document. SketchUp-like tools live or die on the document being the
truth and the view being disposable.

## Decision

Gabarito uses **Three.js** directly, behind `packages/scene`, with the following rules:

- `scene` owns all Three.js objects and is the **only** package that imports `three`.
- The scene graph is a **derived view** of the `core` entity graph. It is rebuilt or patched from
  document state and never stores authoritative data. Nothing may be read back from Three.js to
  determine what the document contains.
- `core` and `geometry` contain no Three.js types, including in their public interfaces. Adapters
  live in `scene`.
- Picking uses raycasting against our own derived structures plus, where precision matters, the
  `geometry` kernel's own intersection math — not Three.js's, so picking semantics are testable
  headlessly.
- Rendering is capped to demand-driven redraws where possible; a static scene must not burn GPU
  continuously.

## Consequences

**Good:** enormous, well-documented ecosystem and the highest agent familiarity of the WebGL
options; batteries included for cameras, controls, materials, shadows, and post-processing; GLTF
loaders exist for import/export; easy to hand off to a future professional renderer for lighting
studies because the interface is a narrow adapter.

**Bad:** Three.js is a moving target with breaking changes between major versions, so `scene` must be
ready to absorb churn; it is not a CAD kernel, so booleans, fillets, and precise NURBS-like surfaces
are our problem ([0011](./0011-geometry-kernel-strategy.md)); its default Y-up, metres-ish
conventions fight our Z-up millimetre world ([0008](./0008-units-coordinates-precision.md)), which is
why the conversion is confined to `scene`; per-object materials scale worse than instanced rendering,
so large models will need batching work we have not designed yet.

**Neutral:** a thin abstraction over `scene` (a viewport facade) will be needed so tools and plugins
never hold Three.js objects; that facade is the seam where a different renderer could be swapped in.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Babylon.js | Comparable engine, stronger built-ins (physics, PBR, lights, inspectors), but a heavier API surface and a smaller pool of agent-familiar examples. Kept as the fallback if lighting work proves painful. |
| Raw WebGL2 / WebGPU | Total control, far more code, and a rendering engine is not the differentiator of this product. |
| react-three-fiber | Declarative scene management is attractive, but it makes React own the scene lifecycle, contradicting the rule that the viewport is independent of React. |
| PlayCanvas | Engine-plus-editor, opinionated about project structure, awkward to embed as a library. |
| Filament / a WASM renderer | Better raw performance, much worse iteration speed and tooling. |

## Links

- Related: [0002](./0002-language-and-build-toolchain.md), [0008](./0008-units-coordinates-precision.md),
  [0011](./0011-geometry-kernel-strategy.md), [0006](./0006-document-model-and-commands.md)
- Specs: `docs/specs/0003-geometry-kernel-spike.md` (informs the geometry/render split)
