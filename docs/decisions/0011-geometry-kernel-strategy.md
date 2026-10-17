---
id: 0011
title: Geometry kernel deferred: extrusion only for now
status: rejected
date: 2026-10-17
tags: [geometry, csg, kernel, deferred]
supersedes: []
superseded_by: null
specs: []
---

# 0011 — Geometry kernel deferred: extrusion only for now

> **Rejected on 2026-10-17.** The first modeler slice needs no boolean operations at all: push/pull
> is a plain extrusion. No spike was run, and the spike spec that used to be the prerequisite here
> was pruned as speculative. Revisit this record the first time a feature genuinely needs boolean
> cuts (a wall opening, a joinery dado).
>
> The analysis below is kept because the options did not go away — they are just not needed yet.

## Context

A SketchUp-like modeler can need more than triangle rendering: faces bounded by edges, extrude along
a normal, push/pull, offset, intersection between solids, and a notion of inside/outside. Walkthrough
models tolerate triangle soup; a woodworking cut list and a lighting study do not.

Three.js is a renderer, not a CAD kernel ([0003](./0003-rendering-engine-threejs.md)). It has no
solid model, no robust boolean operations, and no topology guarantees.

The options are broadly: adopt an existing mesh-based boolean library, adopt a WASM geometry kernel,
or build our own. The last option is a multi-year project on its own.

## Decision

**Nothing is adopted and nothing is built yet.** Solid operations are limited to extrusion, which
`packages/geometry` already provides:

- Push/pull extrudes a face along its normal into a closed solid: side walls, connecting edges, and a
  cap. No CSG, no library, no WASM.
- Operations that genuinely need booleans — cutting an opening through a wall, subtracting a dado
  from a board — are out of scope until a spec asks for one.
- When a boolean is needed, `packages/geometry` is the place to add it, behind its own interface, so
  the library choice stays contained. This record is the analysis to start from.

## Consequences

**Good:** no third-party geometry dependency, no licence questions, no WASM toolchain, and no bundle
weight; extrusion is trivial to test, and it covers the whole feature set shipped so far; the
interface boundary is a decision that can wait until there is a real caller to shape it.

**Bad:** anything that needs a genuine boolean is simply unavailable — no openings, no joinery cuts,
no real solid intersection. A user who expects SketchUp's "cut the wall" behaviour will find it
missing, and the workaround (draw it in pieces) is exactly the tedium the product exists to remove.
The cost of adopting a kernel later is also higher than it would have been, because the document
format and the face representation will already be in use.

**Neutral:** mesh booleans are not robust anyway — coplanar faces and near-degenerate geometry
produce artefacts and need tolerance and cleanup work — so deferring this avoids paying that cost
before there is a reason to. Curved surfaces are already tessellated
([0013](./0013-curves-are-tessellated.md)) and are not affected either way.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Adopt a mesh boolean library now | No caller exists yet; the choice is better made against a real case, and the licence and robustness questions are real. |
| Adopt a WASM kernel (manifold, OpenCascade) | Plausibly the end state, but a large upfront payload and a steep API, for a capability nothing needs yet. |
| Build a B-rep kernel | Years of work, and not the product's differentiator. |
| Use Three.js `BufferGeometry` as the model | Triangle soup with no topology; push/pull and cut lists become guesswork. Three.js stays a renderer ([0003](./0003-rendering-engine-threejs.md)). |
| Delegate booleans to the renderer | Renderers do not do robust CSG. |

## Links

- Related: [0003](./0003-rendering-engine-threejs.md), [0008](./0008-units-coordinates-precision.md),
  [0010](./0010-testing-strategy.md), [0013](./0013-curves-are-tessellated.md)
- Spec: `docs/specs/0004-core-document-geometry-viewport.md`

