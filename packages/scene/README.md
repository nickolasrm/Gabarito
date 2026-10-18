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
