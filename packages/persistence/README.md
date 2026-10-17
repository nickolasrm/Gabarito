# @gabarito/persistence

**Status:** empty — no code yet

## Responsibility

Getting documents in and out, with no server involved.

- Autosave to IndexedDB, with OPFS preferred where available and suitable for large binaries.
- Recovery snapshots so a closed tab is not a lost model.
- The `.gabarito` project file: a versioned zip container holding a JSON manifest, the document graph,
  and binary entries (meshes, textures).
- Format versioning and migration.
- **Preserving unknown plugin data verbatim** across load and save
  ([invariant 10](../../docs/architecture/invariants.md)).
- Import/export adapters: glTF, OBJ, STL and friends, mapped into and out of the document.

## Owns

Durability and the file format.

## Must not

- Talk to a network. Nothing is uploaded, ever
  ([decision 0007](../../docs/decisions/0007-local-first-persistence.md)).
- Know about specific plugins. Plugin data is namespaced and opaque to this package.
- Be a command source; loading is an explicit, non-undoable boundary, not an edit.

## Public interface

None yet. The project file format is defined by the persistence spec.

## Depends on

`@gabarito/core`, `@gabarito/geometry`.

## Read next

[`docs/decisions/0007-local-first-persistence.md`](../../docs/decisions/0007-local-first-persistence.md)
