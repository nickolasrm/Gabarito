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
