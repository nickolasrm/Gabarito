---
id: 0017
title: Faces hold holes
status: implemented
date: 2026-10-17
packages: [core, geometry, scene, tools]
decisions: [0023]
supersedes: null
---

# 0017 — Faces hold holes

## Goal

The border of an opening is **one face with a hole**, the way the product this is inspired by keeps
it — not four rectangle strips with seams between them. After this spec, the ring that a cut leaves
selects, renders and picks as one face.

## Why now

The cut shipped through the kernel ([0016](./0016-cut-holes-with-push-pull.md),
[decision 0022](../decisions/0022-cuts-run-on-manifold.md)) and the owner reported the border
rendering as cut-up strips: the conversion splits the kernel's ring for a document model whose faces
are single loops. The model changes instead ([decision 0023](../decisions/0023-faces-hold-holes.md)).

## Scope

**In scope**

- `FaceEntity.holes?: EntityId[][]` — optional hole loops; absent on faces without holes, so existing
  documents load unchanged.
- `core`: face loops all count — removal closure, selection support, and a `faceHoles` accessor next
  to `facePositions`.
- The cut conversion emits a two-loop group as one face with a hole; `conformRects` and
  `rect.subtract` lose their last caller and are removed from `geometry`.
- `scene`: triangulate faces with holes as one region; picking excludes a hit inside a hole.
- Push/pull refuses a face that has holes with a message.
- Tests: a ring face round-trips a cut, renders as one region, and undo still restores exactly.

**Out of scope**

- Pushing or pulling a face that has holes (SketchUp does add material there; our straight-cut tool
  refuses until asked).
- Curved or non-rectilinear holes. The cut is still two axis-aligned boxes; the hole is always a
  rectangle in a plane.
- Persistence. Nothing is stored yet; when it ships it serialises whatever the model holds.

## Plan

1. `core`: `FaceEntity.holes?`, a `faceHoles(doc, face)` accessor, and loop-aware removal closure and
   selection support.
2. `core`: the cut conversion keeps kernel loops whole — one boundary loop is a face, two are a face
   with a hole, more is refused. `planCut` refuses a holed face before reading its rectangle.
3. `geometry`: delete `conformRects` and `rect.subtract` with their tests; the kernel route has no
   strip arithmetic left.
4. `scene`: `THREE.ShapeUtils.triangulateShape` for a face with holes; `pickFace` rejects a plane hit
   that lands inside a hole loop.
5. Tests at each layer, then the browser pass: one ring face, no seams, undo exact.

## Design notes

**Why the model, not the render.** Hiding seams would leave a model that says four faces where the
user sees one: selection would grab a strip, push/pull would move one, and the next cut would meet
four faces where the kernel returns one. The kernel already does the merge; storing its output is
less work than un-merging it everywhere downstream.

**Why the refusal for pushing a ring.** A ring pushed along its normal is a prism with a hole — a
solid whose faces include two rings. The cut handles rings fine, but the extrusion builder does not,
and one refusal is cheaper than a wrong solid.

## Risks

| Risk | Mitigation |
|---|---|
| A place that walks `face.points` and misses `holes` | Grep is part of the change: every walker found is made loop-aware or argued about in the spec. |
| Hole winding disagreeing with the renderer | The renderer triangulates by contour-plus-holes, not by winding; the kernel's winding is kept as emitted. |
| Documents with no holes still loading | The field is optional and absent; nothing else about the entity changed. |

## Verification

- [ ] A cut leaves one ring face with one hole loop, and its edges are shared exactly twice
- [ ] The border renders without internal seams, and selecting it grabs the whole border
- [ ] Picking inside a through-hole misses the ring faces on both sides
- [ ] `planCut` refuses a holed face with a message; the document is unchanged
- [ ] Undo restores the pre-cut document exactly
- [ ] Unit and e2e suites pass; the static build stays serverless

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/decisions/README.md`
- [ ] `packages/{core,geometry,scene}/README.md`
- [ ] `docs/features/sketchup-core.md` (push/pull), `docs/glossary.md` (face)

## Result

Shipped as planned. One addition beyond the plan: `THREE.ShapeUtils.triangulateShape` can come out
wound against the face's normal, so `scene` compares the triangulation's normal to the document's and
flips the triangle order once per face — the winding stays the document's, not the tessellator's.

The ring face comes out of the cut with its loops exactly as the kernel mesh wound them; `conformRects`
and `rect.subtract` are deleted with their tests. Verified: 107 unit tests, 23 e2e, typecheck clean,
static build unchanged in shape (WASM as a hashed asset).
