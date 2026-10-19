# scene

Derived Three.js rendering and visibility-aware analytic picking.

`createViewport(host, store)` owns a canvas, Z-up perspective camera, OrbitControls and disposable
render resources. It exposes `ray`, `project`, `pick`, `preview`, `feedback`, `frame`, `cameraState` and `dispose`.
Document geometry remains in core. Face triangles come from geometry's shared triangulator.

`pick(model, view, x, y, pixelTolerance)` prefers visible vertices, then edges, then the nearest face.
The projection contract includes forward depth and near/far visibility. Each point/edge candidate is
occlusion-tested on the ray through its own world position. There is no relative depth tie.
`faceHit` intersects actual triangulated material, excluding holes and geometry behind the camera.
Segments crossing the near plane are omitted from snap targets until both endpoints are in front.

Middle-button orbit and Shift+middle-button pan use OrbitControls' ROTATE mapping; the modifier is
handled by OrbitControls. Wheel zoom never sends editing commands. Left mouse belongs to tools.

Run `npm test` for headless picking regressions and `npm run test:e2e` for camera gestures.

`feedback(hit)` renders a square Vertex marker, diamond Edge marker and edge highlight at the picked
world position; faces get a transient tint. The controller supplies the same eligible target it
uses for inference. Feedback never changes selection or geometry and is cleared on model changes,
resize, framing and camera navigation. Single face selection tints only that face; selected vertex
markers appear only when vertex IDs are explicitly selected.

`pick` includes exact edge midpoints, editable infinite rulers, world axes, world origin and virtual
ruler/ruler or ruler/edge intersections. Real vertices take priority, then midpoint/intersection
points, real edges and rulers. All candidates pass the same forward-depth and occlusion checks.
`Hit.snap` names `midpoint`, `intersection` or `origin`; guide hits use `kind: "guide"`.
Face hover shows visible midpoint dots on outer and hole boundaries; a targeted midpoint gets a
labeled circle. `cursorHint(text, x, y)` positions measurement/proportion text beside the pointer.

`references.ts` computes virtual intersections and clips mathematical infinite lines against camera
frustum halfspaces. User guides render dashed, world axes render colored in both directions, and
neither enters model triangulation. References update with the camera; model framing still uses
real vertices. Guide transform previews use the same clipping path. No finite document edge stands
in for a ruler.

Midpoint hits retain `sourceEdge`; coincident virtual intersections cannot replace them with a
vertex hit. `visible(point)` exposes the same camera/occlusion check to headless tool inference.
Face alignment/diagonal hits show labeled markers. Infinite preview rulers render dashed, while
finite measurement and inference segments remain solid. Preview objects never enter picking.

`handles(points, activeId?)` renders transient scale grips as fixed-size, pointer-transparent DOM
squares over world positions. IDs/labels come from tools. Camera changes, resizing and document
updates reproject them; forward-depth and surface occlusion hide ineligible grips. The active drag
grip remains visible through the original mesh so shrinking previews remain readable. These
markers never enter document geometry or entity picking. Empty input and viewport disposal remove
their DOM nodes and listeners. The ordinary `preview` API renders the box and transformed edges.

The viewport renders/picks `Store.getScene()`, a derived flattening of definitions and instance
transforms. This preserves primitive snap targets and occlusion across context boundaries without
making them editable topology. Selection ownership is resolved by core, not renderer object IDs.
While editing, active faces are mint and the surrounding contexts are dimmed. Face/edge markers,
framing, reference lines and scale handles all use the same world geometry.

`setHighlightComponents(enabled)` colors all derived component faces, edges, vertices and rulers without changing
selection or history. `SceneModel.componentEntities` identifies component geometry; `inactive` now
means outside the active context and all of its descendants, so nested pieces highlight with their
parent while remaining atomic selections until entered. Other linked instances remain outside.
