---
id: 0006
title: Document model with commands as the only mutation path
status: accepted
date: 2026-10-17
tags: [core, state, undo, commands, persistence]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0006 — Document model with commands as the only mutation path

## Context

Every UI surface in a modeling tool is a *view* of the same object: the document. Tools, panels,
the viewport, the outliner, and later the lighting heatmap all need consistent state. The usual
failure is state scattered across tool instances, React components, and Three.js objects, producing
undo that misses a change, panels that show stale values, and bugs that only appear when two views
disagree.

Undo is the forcing function: a tool that mutates state directly cannot be undone reliably, and in a
CAD tool undo is used constantly.

## Decision

`packages/core` holds one **document store** and one way to change it.

- The document is an **entity graph**: a tree of typed entities (group, component instance, face,
  edge, light, dimension, camera…) with parent/child links and stable opaque IDs.
- **Commands are the only mutation path.** A command is a plain, serialisable object describing an
  intent (`{ type: "entity.update", id, patch }`, `{ type: "solid.extrude", faceId, distance }`).
  Internally implemented commands may be richer than their serialised form, but the serialised form
  must always exist.
- Each command provides an **inverse** so undo/redo is a stack of command pairs rather than of
  document snapshots.
- The store exposes **subscribe** and **transact**. A transaction groups commands, produces a single
  undo entry, and emits exactly one change notification.
- **Subscribers are views.** `scene`, `ui`, and tools subscribe and re-read; they never mutate the
  store, and they never cache authoritative values across notifications.
- **Selection is part of the store**, not of the tools or the DOM, so any view can render it and any
  tool can act on it consistently.
- **The store is headless.** No React, no Three.js, no browser globals — testable in plain Node
  ([invariant 7](../architecture/invariants.md)).
- **Ids, not object references, cross the store boundary.** Anything outside `core` refers to
  entities by ID.

## Consequences

**Good:** undo/redo falls out of the design rather than being retrofitted; state lives in one place,
so views cannot disagree; commands are an auditable, loggable record of user intent — the natural
hook for replay, tests, macros, and a future collaborative or scripted mode; headless tests can
drive the whole document without a browser; plugin-contributed commands behave exactly like built-in
ones.

**Bad:** every mutation needs a command written and an inverse maintained, which is more work than
assigning a field, and an incorrect inverse is a subtle bug that surfaces only on undo; large
documents need care because notifications can be frequent; the entity graph is a structure we must
version and serialise ourselves; some UI-only state (hover, drag preview) must be deliberately kept
*out* of the store, or undo will fill up with noise.

**Neutral:** the store's API is the most important interface in the repository, so it will change
cautiously and via specs; granularity of commands is a design decision made per feature, not a
global rule.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Mutable objects plus manual change events | The default in many small CAD experiments; undo becomes unreliable and view desync becomes normal. |
| Snapshot the whole document per change | Simple and correct, too expensive for large models and hopeless for a browser memory budget. |
| Immer/Redux-style reducer over a plain serialisable state tree | Genuinely close, but reducer actions lack inverses and typically coerce the geometry model into plain JSON, which is costly for large meshes. Commands keep typed holders and record inverses explicitly. |
| Observer/ECS with systems mutating components | Excellent for simulation; awkward for the parent/child grouping semantics a modeling tool needs. |
| Store geometry directly in Three.js objects and reverse-engineer state | Makes the renderer authoritative, which [0003](./0003-rendering-engine-threejs.md) forbids. |

## Links

- Related: [0003](./0003-rendering-engine-threejs.md), [0004](./0004-repository-layout.md),
  [0007](./0007-local-first-persistence.md), [0008](./0008-units-coordinates-precision.md)
- Vocabulary: [`../glossary.md`](../glossary.md)
