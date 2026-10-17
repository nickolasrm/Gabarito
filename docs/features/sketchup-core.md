# SketchUp-like core modeling

**Not a plugin.** This is the modeler itself: `packages/core`, `packages/geometry`, `packages/scene`,
`packages/tools`, `packages/ui`, `packages/persistence`. Everything else plugs into it.

## The reference model

SketchUp's virtue is not its feature list, it is its interaction model: draw faces, pull them into
solids, everything snaps and infers, and grouping keeps a model from ending up as one welded mesh.
A clone is done when a user can build a small building without fighting the tool.

## Capabilities we are aiming at

| Capability | Notes |
|---|---|
| Draw on faces and planes | Line, rectangle, circle, arc, polygon. Faces are created implicitly from closed loops, the way SketchUp does it. |
| Push/pull | The defining operation: extrude faces into solids and cut them back. |
| Move / rotate / scale | With copy, array, and axis locking. |
| Inference and snapping | Endpoints, midpoints, intersections, on-face, on-edge, axis and parallel/perpendicular locks, plus measurement entry while dragging. |
| Groups and components | Reusable instances with their own coordinate systems — the basis of any real workflow. |
| Materials and styles | Painting faces, simple texturing, edge/face display styles. |
| Outliner and entity info | Navigate and inspect the model. |
| Sections and shadows | Viewing aids that also preview the lighting domain later. |
| Undo/redo everywhere | Non-negotiable, and the reason for the command model ([decision 0006](../decisions/0006-document-model-and-commands.md)). |
| Save/load a portable file | The `.gabarito` container ([decision 0007](../decisions/0007-local-first-persistence.md)). |
| Import/export | glTF and OBJ first; STL for 3D printing later. |

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

No spec covers the modeler yet. Tooling comes first
([spec 0002](../specs/0002-monorepo-tooling-bootstrap.md)) and the geometry kernel decision second
([spec 0003](../specs/0003-geometry-kernel-spike.md)). The modeler is then built in slices — document
+ geometry, then viewport, then tools, then persistence — each with its own spec.

Related: [module boundaries](../architecture/module-boundaries.md),
[glossary](../glossary.md).
