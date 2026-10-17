# @gabarito/scene

**Status:** implemented — Three.js viewport, Z-up camera, analytic picking

## Responsibility

Everything between the document and the GPU.

- The renderer, render loop, lights, and grid.
- The spherical orbit camera and all navigation input.
- Document → scene rebuilding, on every change of `revision`.
- Analytic picking against document entities.
- Projection helpers used by the tools for snap tolerance and screen-space overlays.

## Public interface

```ts
Viewport(container, store)   setHandlers, setPreview, setSnap, markDirty, frameDocument,
                            resetView, centerView, worldToScreen, pixelsPerWorldUnit,
                            toleranceAt, raycast, raycastPlane, viewDirection, dispose
CameraController             orbit, pan, zoom, frame, worldToScreen, screenToRay
pick(ray, doc, tolerance)    → PickHit | null
rebuildScene(graph, doc)     derived scene from the document
COLORS                       shared palette
```

## Orientation: there is no conversion anywhere

The world is Z-up and Three.js runs in document coordinates directly — the camera simply sets
`up = +Z`. This removes the axis conversion the original design note anticipated, so picking,
projection and tool math all share one coordinate system
([decision 0008](../../docs/decisions/0008-units-coordinates-precision.md)).

## Navigation

| Input | Action |
|---|---|
| Middle-mouse drag | Orbit |
| `Shift` + middle-mouse drag | Pan |
| Wheel | Zoom, anchored to the pointer |
| `Home` | Frame the document |

Tool input is bound to the left button only, so navigation and drawing never compete.

## Owns

All Three.js objects. The scene graph is a **derived view**: it is thrown away and rebuilt from the
document, and nothing is ever read back from it.

## Must not

- Be authoritative for anything ([invariant 5](../../docs/architecture/invariants.md)).
- Be imported by `ui` (React never touches the viewport) or by `tools`.
- Let Three.js types appear in another package's public interface — `tools` describes the viewport
  as its own `ViewportAdapter` and `app` matches them structurally.

## Depends on

`@gabarito/core`, `@gabarito/geometry`, `three`.

## Read next

[`docs/decisions/0003-rendering-engine-threejs.md`](../../docs/decisions/0003-rendering-engine-threejs.md)
