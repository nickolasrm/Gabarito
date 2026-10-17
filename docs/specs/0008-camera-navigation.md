---
id: 0008
title: Camera navigation
status: implemented
date: 2026-10-17
packages: [scene]
decisions: [0003, 0008, 0012]
supersedes: null
---

# 0008 — Camera navigation

## Goal

Navigation that never fights the tools. After this spec, a user orbits with a middle-mouse drag, zooms
with the wheel, and pans without touching any drawing tool's bindings.

## Why now

Every tool in [spec 0007](./0007-drawing-and-transform-tools.md) consumes left-click and drag, so the
camera must live entirely on other inputs. Getting this wrong makes the whole toolset unusable, and it
is cheap to fix now.

## Scope

**In scope**

| Input | Action |
|---|---|
| Middle-mouse drag | Orbit around the orbit target |
| `Shift` + middle-mouse drag | Pan (move the orbit target in the view plane) |
| Scroll wheel | Zoom toward and away from the target, and toward the pointer when it is over the viewport |
| `Home` | Frame the whole document |
| `Esc` (camera focus) | Reset the orbit target to the document centre |

- Orbit is spherical around a target point, with `+Z` as the world up axis; polar angle is clamped so
  the camera never flips through the pole.
- Zoom is exponential in wheel delta so it feels linear at every scale, and clamps at a minimum and
  maximum distance.
- Projection helpers the tools need: `worldToScreen(point)`, `screenToWorldRay(x, y)`, and
  `pixelsPerWorldUnit(atPoint)`, used for snap tolerance
  ([spec 0006](./0006-snapping-inference-axis-locks.md)).

**Out of scope**

- Named standard views (top/front/right), walk-through navigation, and camera animation.
- Orthographic projection. Perspective only for this slice; the camera interface keeps a projection
  field so an orthographic mode is additive later.
- Touch gestures and trackpad-specific gestures beyond what maps to wheel and drag.

## Plan

1. `packages/scene/src/camera.ts`: `CameraController` holding target, distance, yaw, pitch, with
   `orbit`, `pan`, `zoom`, `frame(bounds)`, and the projection helpers.
2. Wheel and middle-button handling inside the viewport's canvas event handlers, isolated from tool
   input.
3. `Home` framing from the document bounds via `geometry` bounds.
4. Tests: spherical maths, clamping, zoom direction, and that `worldToScreen`/`screenToWorldRay`
   round-trip.

## Design notes

Keeping the camera in spherical coordinates around a target makes `frame(bounds)` and pan trivial and
avoids gimbal problems at the poles. The camera's `up` is `+Z`, matching the document convention, so no
coordinate conversion exists anywhere ([decision 0008](../decisions/0008-units-coordinates-precision.md)).

Zoom toward the pointer (rather than the screen centre) is what makes a modeling viewport feel
precise; it is implemented by moving the target along the ray under the pointer as the distance
changes.

## Risks

| Risk | Mitigation |
|---|---|
| Middle-drag orbiting also triggering a tool | Tool input is bound to the left button only; camera input is bound to middle and wheel. |
| Zoom toward the pointer drifting the target over time | The target shift is proportional to the distance change and re-derived each event, not accumulated. |
| Camera at huge or tiny distances breaking snapping tolerance | Tolerance is derived from `pixelsPerWorldUnit` at query time, so it stays screen-constant. |

## Verification

- [ ] Middle-drag orbits and never moves the document
- [ ] Wheel zooms toward the pointer
- [ ] `Shift`+middle pans without changing orientation
- [ ] `Home` frames the document
- [ ] `worldToScreen(screenToWorldRay(p))` is within a pixel of `p`
- [ ] No camera input is reachable from the left mouse button

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`
- [ ] `packages/scene/README.md` (navigation bindings)
- [ ] `docs/glossary.md` if new terms appear

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** the spherical Z-up camera controller, middle-mouse orbit, `Shift`+middle pan,
  wheel zoom anchored to the pointer, `Home` to frame the document, and the projection helpers the
  tools need (`worldToScreen`, `screenToWorldRay`, `pixelsPerWorldUnit`) with tolerance derived from
  screen pixels.
- **Deviations from the plan:** `Esc` resets the camera target only when the tool controller does not
  consume it first, so `Esc` always cancels the operation in progress. That is the correct priority
  and is handled by ordering in the keymap.
- **Follow-up specs:** standard views (top/front/right), orthographic projection, touch gestures.
