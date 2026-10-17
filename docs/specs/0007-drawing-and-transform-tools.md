---
id: 0007
title: Drawing and transform tools with typed input
status: implemented
date: 2026-10-17
packages: [tools, scene, ui, app]
decisions: [0006, 0012, 0014]
supersedes: null
---

# 0007 — Drawing and transform tools with typed input

## Goal

The first usable toolset: select, line, rectangle, circle, push/pull, move, rotate, ruler, and measure —
each of them operable by pointer alone, and each of them numerically controllable by typing a value
during the operation.

## Why now

This is the modeler the product is founded on, inspired by SketchUp's interaction model
([`docs/features/sketchup-core.md`](../features/sketchup-core.md)). It also proves the command model
and the inference engine under real interaction.

## Scope

**In scope**

| Tool | Shortcut | Operation |
|---|---|---|
| Select | `Space` | Click to select an edge, face, or guide; `Shift`+click to add; drag a box to select everything inside it; `Delete` removes the selection. |
| Line | `L` | Click a start point, click an end point. A closed loop of edges creates a face. |
| Rectangle | `R` | Click a corner, then the opposite corner, drawn on the plane under the pointer or the locked axis plane. Creates four edges and a face. |
| Circle | `C` | Click a centre, then a radius. Tessellated polygon with a face ([0013](../decisions/0013-curves-are-tessellated.md)). |
| Push/Pull | `P` | Click a face, drag along its normal; the face is extruded into a solid. `↓` inverts the direction. |
| Move | `M` | Select or click entities, then drag. Axis-lockable. |
| Rotate | `Q` | Click a pivot, then drag around the locked axis (default `Z`). |
| Ruler | `T` | Two clicks create an infinite guide through them, or, with an axis locked, a guide parallel to that axis at the typed distance. Shows a live distance. |
| Measure | `Shift+T` | Two clicks report the distance; commits a dimension entity on `Enter`. |

- **Typed values.** While an operation is in progress, digits, `.`, `,`, and `-` accumulate into a
  buffer shown in the status bar. `Enter` commits it, `Esc` cancels it and the operation:
  | Tool | Input | Meaning |
  |---|---|---|
  | Line, Move, Ruler, Measure | `100` | length in the current unit |
  | Rectangle | `100, 50` or `100` | width and depth, or a square |
  | Circle | `10` | radius in the current unit |
  | Push/Pull | `50` | extrusion distance |
  | Rotate | `45` | angle in degrees |
  Typed values are parsed in the **current display unit** at commit time
  ([spec 0005](./0005-units-and-measurement.md)).
- **Axis pinning.** The arrow keys from [spec 0006](./0006-snapping-inference-axis-locks.md) constrain
  drawing and transforms to an axis, before or during the drag.
- Every tool emits commands only; none of them mutates the document
  ([invariant 6](../architecture/invariants.md)).
- `Esc` cancels the operation; `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` undo and redo.

**Out of scope**

- Erase, offset, follow-me, arc, polygon, tape-measure-driven resizing of existing geometry.
- Copy/array modifiers on move.
- Grouping and components.
- Editing an existing entity's vertices, and constraints between entities.
- Snapping to a face's interior as a drawing plane beyond a simple plane hit test.

## Plan

1. `packages/tools/src/types.ts`: the `Tool` contract — `onPointerDown/Move/Up`, `onKey`, `onTyped`,
   `onCommit`, `cancel`, `preview`, `status`.
2. `packages/tools/src/controller.ts`: active tool, pointer routing, the typed-value buffer, and
   command emission into the store.
3. `packages/tools/src/tools/*.ts`: one file per tool, each a small state machine.
4. `packages/scene`: preview rendering for in-progress lines, rectangles, circles, extrusions, and
   rotation, plus hover highlighting.
5. `packages/ui`: toolbar with tool buttons and their shortcuts, status bar readouts per spec 0005.
6. `packages/app/src/keymap.ts`: tool shortcuts, arrows, Esc, undo/redo.
7. Tests: each tool's state machine driven by synthetic pointer sequences asserts the exact commands
   emitted; typed input is tested across units.

## Design notes

Typed input and axis locking are **input-layer** concerns, not per-tool features
([decision 0012](../decisions/0012-tool-input-model.md)): a tool declares how many numbers it accepts
and what they mean, and the controller does the parsing, buffering, and display. Adding a tool
therefore does not mean reimplementing either behaviour.

Tools are state machines over `idle → first point → dragging/dimensions → commit`. Each keeps at most
one anchor plus the live cursor; nothing is stored in the document until commit.

## Risks

| Risk | Mitigation |
|---|---|
| Tool state machines sharing code poorly | One shared `anchor` + `preview` helper; tools that need more document state get their own small reducer. |
| Push/pull producing invalid solids on non-planar faces | Refuse with a status message when the face is non-planar or has fewer than three distinct points. |
| Typed input competing with shortcuts | Digits and separators are captured by the input controller before the keymap sees them; `Esc` always wins. |
| Rectangle plane ambiguity on an empty document | Default to the ground plane `Z=0`; on a face, use the face plane. |
| Rotate around a locked axis being confusing | The locked axis is drawn through the pivot, and the angle is always displayed while dragging. |

## Verification

- [ ] Every tool in the table is operable by pointer alone and by typed value
- [ ] Rectangle `100, 50` with metres selected produces 100 000 mm × 50 000 mm
- [ ] Push/pull on a rectangle face produces a closed solid with six faces
- [ ] Undo reverses every tool operation exactly once
- [ ] Axis lock constrains line, move, rotate, and ruler
- [ ] `Esc` mid-operation leaves no document change

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`
- [ ] `docs/features/sketchup-core.md` capability status
- [ ] `packages/tools/README.md` (tool contract and shortcuts), `packages/ui/README.md`

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** nine tools (select, line, rectangle, circle, push/pull, move, rotate, ruler,
  measure), the shared typed-value and axis-lock input layer, live previews for every operation,
  tool shortcuts, `Esc` cancellation, undo/redo, and an integration test that drives the controller
  with synthetic pointer input and asserts the resulting document, including typed values in
  millimetres and in metres.
- **Deviations from the plan:**
  - **Measure leaves the dimension on the second click**, not on `Enter` as the plan said. Requiring
    a keypress for a measuring tool proved worse to use.
  - Push/pull is click-move-click; the `↓` inversion applies to it only, and a typed distance commits
    straight away. A negative typed value also inverts.
  - Select's box selection encloses only; the SketchUp right-to-left crossing mode is not implemented.
  - The copy/array modifier on move was out of scope as written and is not implemented.
- **Follow-up specs:** erase, offset, follow-me, arc and polygon tools; grouping and components;
  vertex editing; the copy modifier.
