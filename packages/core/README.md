# @gabarito/core

**Status:** empty — no code yet

## Responsibility

The document model and everything that mutates it. This is the single source of truth for the
application ([invariant 5](../../docs/architecture/invariants.md)).

- The entity graph: typed entities, parent/child links, stable opaque IDs.
- The store: `subscribe`, `transact`, and change notification.
- Commands and their inverses; the undo/redo stack.
- Selection.
- Units and unit conversion metadata (millimetres internally).
- Events and the public store API that views consume.

## Owns

State, its mutation, and its history.

## Must not

- Import React, Three.js, or any browser global ([invariant 7](../../docs/architecture/invariants.md)).
- Know anything about woodworking, lighting, architecture, or rendering.
- Hold UI-only state (hover, drag previews) — that lives in the UI or the tool.

## Public interface

None yet. Defined by the spec that first needs it, then documented here. Everything not exported from
the package entry point is internal.

## Depends on

Nothing.

## Read next

[`docs/decisions/0006-document-model-and-commands.md`](../../docs/decisions/0006-document-model-and-commands.md) ·
[`docs/decisions/0008-units-coordinates-precision.md`](../../docs/decisions/0008-units-coordinates-precision.md)
