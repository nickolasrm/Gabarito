---
id: 0038
title: Named linked components and isolated editing contexts
status: implemented
date: 2026-10-18
packages: [core, tools, scene, ui, app]
decisions: [0006, 0027, 0028]
---

# 0038 — Named linked components and isolated editing contexts

## Goal

Turn a selection into a named shared definition with independently placed instances. Outside
editing cannot cut component geometry; editing an instance updates every instance of its definition.
The owner's implementation request accepts this spec.

## Plan

- Store definitions once in core, with entity references and affine instance transforms. Extract
  selected geometry with its boundary closure, preserving boundaries needed by unselected faces.
  Components remain atomic selections outside their context. Move, rotate, scale and delete operate
  on instances there; topology tools operate only on the active geometry scope.
- Double-click enters a component. Show the active context, highlight its geometry, and provide an
  exit button and Escape when no tool action is pending. Nested contexts use the same model;
  reject recursive definition references. Other contexts remain visible and available for snapping.
- Run existing commands in the active instance's world frame and write the result back into its
  shared definition. Render and pick derived geometry without making independent editable copies.
  Every command, including creation, naming and placement, is atomic and undoable.
- Add a sidebar with Make component, editable definition names, and draggable definition entries.
  Dragging onto the viewport previews placement and creates a linked instance on drop. Placement
  uses the hovered surface or ground and snaps to existing references. Cancelled drags create nothing.
- Keep all data client-side and use installed geometry/math facilities. Do not add persistence,
  external asset libraries, component uniqueness/explode commands or plugin APIs in this change.

## Verification

Headless tests cover extraction, shared boundaries, isolated topology, linked changes, transforms,
context entry/exit, nested definitions, cycle rejection, atomic rollback and history. Browser tests
cover creation, naming, double-click editing, linked placement, outside drawing and transformed
instance editing. Run the existing suites, typecheck and static build. Keep port 5173 running,
update owning package docs, and publish a separate PR based on the unmerged Circle/Offset branch.

## Result

Implemented shared definitions, affine instance transforms and scoped world-coordinate editing.
Extraction preserves shared parent boundaries and deleted regions. Atomic creation, placement,
naming and geometry commands support exact history; nested definitions reject cycles. Rendering,
snapping and transform previews use derived geometry with scope ownership. Outside geometry never
enters the active topology transaction. The sidebar provides names, drag previews, linked drops,
context breadcrumbs and exit; cancelled placement creates nothing.

Validation: 195 headless tests pass. The existing browser regressions and five component workflows
pass, including native drag preview/cancellation, naming, isolated drawing and linked transformed
editing. Typecheck and static production build pass. No dependencies or server features were added.
Port 5173 remains available for human verification. Persistence, explode and independent-copy actions
remain out of scope as planned. No deviations from the plan.
