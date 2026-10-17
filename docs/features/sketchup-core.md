# SketchUp-like core modeling

**Not a plugin.** This is the modeler itself: `packages/core`, `packages/geometry`, `packages/scene`,
`packages/tools`, `packages/ui`, `packages/persistence`. Everything else plugs into it.

## The reference model

SketchUp's virtue is not its feature list, it is its interaction model: draw faces, pull them into
solids, everything snaps and infers, and grouping keeps a model from ending up as one welded mesh.
A clone is done when a user can build a small building without fighting the tool.

## Capabilities we are aiming at

| Capability | Status | Notes |
|---|---|---|
| Draw on faces and planes | ✅ | Line, rectangle and circle. Faces are created implicitly from closed loops. |
| Push/pull | ✅ | Extrusion only, no booleans yet ([decision 0011](../decisions/0011-geometry-kernel-strategy.md)). |
| Move / rotate | ✅ | Axis-lockable, with typed distances and angles. |
| Inference and snapping | ✅ | Endpoints, midpoints, edges, guides, virtual intersections, extensions, axes, plus measurement entry while dragging. |
| Guides and measurement | ✅ | The ruler creates construction lines; measure leaves dimensions. |
| Units | ✅ | mm, cm, m, km, in, ft, yd, driving input and readout. |
| Undo/redo everywhere | ✅ | Every tool operation is a command with an inverse ([decision 0006](../decisions/0006-document-model-and-commands.md)). |
| Arc, polygon, erase, offset, follow-me | — | Not started. |
| Scale / move copy / array | — | Not started. |
| Groups and components | — | The basis of any real workflow; not started. |
| Materials and styles | — | Not started. |
| Outliner and entity info | — | Not started. |
| Sections and shadows | — | Not started. |
| Save/load a portable file | — | Nothing is saved yet ([decision 0007](../decisions/0007-local-first-persistence.md)). |
| Import/export | — | Not started. |

## Explicitly not aiming at

- Photorealistic rendering — that is the lighting domain's job.
- Exact NURBS or mechanical B-rep precision
  ([decision 0011](../decisions/0011-geometry-kernel-strategy.md)).
- Reading `.skp` files: the format is proprietary and undocumented. Interop happens through open
  formats.

## Why it is shaped this way

Every capability above is domain-neutral, which is what lets woodworking, lighting, and house building
be plugins. The moment a tool starts knowing about board thickness, it belongs in a feature package.

## Where it is built

The first slices are done: tooling and the static build
([spec 0002](../specs/0002-monorepo-tooling-bootstrap.md)), document/geometry/viewport
([spec 0004](../specs/0004-core-document-geometry-viewport.md)), units
([spec 0005](../specs/0005-units-and-measurement.md)), snapping and axis locks
([spec 0006](../specs/0006-snapping-inference-axis-locks.md)), the first nine tools
([spec 0007](../specs/0007-drawing-and-transform-tools.md)) and camera navigation
([spec 0008](../specs/0008-camera-navigation.md)).

The geometry kernel question is settled: none is adopted, and push/pull is straight extrusion
([decision 0011](../decisions/0011-geometry-kernel-strategy.md)). Persistence is not started.
Next slices, in the order that unblocks the most: **save and load**, then **groups and components**,
then **erase, offset and follow-me**.

Related: [module boundaries](../architecture/module-boundaries.md),
[glossary](../glossary.md).
