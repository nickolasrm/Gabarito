# core

The authoritative model and reversible editing API. No DOM, Three.js or React.

- `model.ts`: `Model`, shared `Vertex`/`Edge`/`Face` entities, boundary access, welding, drawing,
  planar face reconstruction, `conformEdges` (split shared boundaries without creating faces) and validation. Face loops reference vertex IDs; edges are undirected.
- `edit.ts`: serializable `Command` union and geometry editing, including shell orientation,
  extrusion/booleans, deletion and shared-vertex transforms.
- `erase.ts`: deletion merges faces across selected coplanar dividers using polygon union.
  Unselected sketch edges remain; perimeter, explicit face/vertex and noncoplanar edge deletion
  retain their removal semantics. Mixed selections never restore a deleted perimeter.
- `store.ts`: `createStore`, atomic `execute`, `select`, `undo`, `redo`, subscriptions and history.
  Commands run on a copy and publish only after validation. Before/after snapshots are the inverse.
  Entity IDs remain monotonic through undo. Selection itself is not an undo entry.
- `input.ts`: `parseDimensions` and display/input `UNITS` (mm, cm, m, in, ft).

All cross-package imports use `src/index.ts`. `getState()` is a borrowed view: consumers must not
mutate it. There is no persisted file format or public compatibility promise for the old runtime.

A drawing rebuilds affected planar regions. A deleted region or kernel opening is remembered by its
boundary signature. Transform commands reject nonplanar or self-intersecting faces. Push/pull of a
closed component uses a general polygon sweep through Manifold. A single face extrudes to a solid;
a connected open sheet replaces the selected patch and sweeps its boundary, including after earlier
extrusions. Coplanar oriented patches merge or cancel through Manifold CrossSection, so retracting
a patch removes the old wall region. Open sheets retain surface-extrusion semantics, not solid cuts.
See [spec 0022](../../docs/specs/0022-open-sheet-pushpull.md).

`npm test` checks region area, holes, welded intersections, solid volume and closedness, repeated
edits, rollback and history. See [spec 0021](../../docs/specs/0021-rewrite-modeler.md).

A draw command may include `fillLoop`: an explicitly requested closed contour. It clears a deleted
region only when its rebuilt outer boundary matches that contour, including collinear split points.
Other deleted regions remain suppressed. `Model.erased` stores boundary loops so `conformEdges`
updates deletion markers alongside face loops when an edge is split; their signatures stay valid.

`Guide` entities store an infinite non-geometric line as `origin` and nonzero `direction`.
`{ type: "guide", origin, direction }` creates one undoable ruler; ordinary delete/move/rotate
commands also work on guides. Validation rejects nonfinite origins/directions and zero directions.
Geometry queries, face rebuilding and solid operations exclude guides by kind. `guides(model)`
queries editable rulers; `referenceLines(model)` adds the built-in `WORLD_AXES`. World axes and
`world:origin` are references outside the entity map, so selection/deletion cannot modify them.

`{ type: "scale", ids, anchor, factors }` scales selected shared vertices once about a fixed world
anchor with independent positive X/Y/Z factors. Selected rulers transform their origin and direction;
unselected entities keep their coordinates. `scale.ts` validates the factors and anchor, and the
existing transaction validation rejects nonplanar/invalid results before publishing. History restores
exact snapshots. Finite positive factors are accepted when resulting geometry stays valid.

`{ type: "offset", face, distance }` resolves an existing face and adds all its inset contours through
ordinary shared drawing topology. The source material remains: borders and inner regions become
separate faces, ready for selection or extrusion. Existing erased holes stay erased. Kernel erosion
handles concave splits and holes; invalid distances, collapse or invalid topology reject the atomic
transaction without a history entry. Circle tools also use the existing draw/fillLoop command.

Components are scoped geometry, not welded meshes in the parent. `Component` references a named
`ComponentDefinition` in `Model.definitions` and stores an invertible affine `Transform`. Definitions
contain geometry and may contain other component instances; recursive references are rejected.
`make-component`, `rename-component` and `place-component` commands participate in atomic history.
Extraction includes selected face boundaries and preserves/clones boundaries still needed outside.
Deleting all instances retains the sidebar definition for later placement.

`Store.getState()` returns the active scope in world coordinates. `enterComponent(id)` and
`exitComponent()` change the instance path without an undo entry; `getContext()` supplies its names.
All ordinary topology commands affect only that scope. Edits inverse-transform back into its shared
definition, so every linked instance updates. Instance move/rotate/scale changes its transform only.
`getScene()` provides derived world geometry with scoped IDs, selection, `owners` and `inactive`
metadata. Use it for references/rendering, never as editable document geometry. `selectionTarget(id)`
resolves a picked primitive to a direct instance or active entity, returning null for other scopes.
`selectionGeometry(model)` expands an active selection for bounds and transform previews. History
restores the edit context with the exact document snapshot; IDs stay monotonic across undo.
