# @gabarito/core

**Status:** implemented — document, commands, undo, units

## Responsibility

The document model and everything that mutates it. The single source of truth for the application
([invariant 5](../../docs/architecture/invariants.md)).

- The entity graph: points, edges, faces, guides, dimensions
  ([decision 0014](../../docs/decisions/0014-guides-and-dimensions-as-entities.md)).
- The store: `subscribe`, `dispatch`, `transact`, `undo`, `redo`.
- Commands as plain data with an inverse, produced at apply time
  ([decision 0006](../../docs/decisions/0006-document-model-and-commands.md)).
- Selection and settings.
- Units: the registry, `parseLength`, `formatLength`
  ([decision 0008](../../docs/decisions/0008-units-coordinates-precision.md)).

## Owns

State, its mutation, and its history.

## Must not

- Import React, Three.js, or any browser global ([invariant 7](../../docs/architecture/invariants.md)).
- Know anything about woodworking, lighting, architecture, or rendering.
- Hold UI-only state.

## Public interface

```ts
createDocument(settings?)            // a fresh DocumentState
createStore(settings?)               // { getState, subscribe, dispatch, transact, undo, redo }
applyCommand(doc, cmd) / revertCommand(doc, cmd, inverse)
```

Entity kinds and the full command list are in `src/types.ts` and `src/commands.ts`. Selectors for
derived data (`edgesOf`, `facesOf`, `facePoints`, `pointIdsForEntities`, `documentBounds`) are in
`src/document.ts`.

Solid operations live in `src/cut.ts`: `shellFaces` computes the closed set of faces bounding a solid
(shared-edge **or** coplanar-overlap adjacency — a face drawn inside a face still finds its solid), and
`planCut` returns one of three outcomes: `cut` or `add` (remove and add entity lists, one transaction
— the sweep hit the solid, or missed and the prism merged with it
([decision 0025](../../docs/decisions/0025-pull-is-a-union.md))), `extrude` (no solid at all), or
`refuse` with a message. The kernel feeds on the shell as a mesh — drawn-on markings dropped, loops
triangulated, the sweep's overlap measured — so it lands on any rectilinear closed solid, including
one an earlier cut left ([decision 0024](../../docs/decisions/0024-cuts-enter-any-rectilinear-solid.md));
the ring an opening leaves is stored as one face with every hole it gets — there is no limit
([decision 0026](../../docs/decisions/0026-face-holds-every-hole.md)), and a face that itself has
holes is refused rather than pushed. A cut before the kernel has loaded is refused with a "still
loading" message.

**Note on the dependency rule.** `core` imports `@gabarito/geometry` and nothing else
([decision 0015](../../docs/decisions/0015-core-depends-on-geometry.md)). It re-exports the geometry
types it uses (`Vec3`, `Bounds`) so consumers of `core` do not have to reach into `geometry` for them.
A test asserts the exact allowed import set.

## Depends on

`@gabarito/geometry`.

## Read next

[`docs/decisions/0006-document-model-and-commands.md`](../../docs/decisions/0006-document-model-and-commands.md) ·
[`docs/decisions/0014-guides-and-dimensions-as-entities.md`](../../docs/decisions/0014-guides-and-dimensions-as-entities.md)
