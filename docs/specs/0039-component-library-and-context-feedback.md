---
id: 0039
title: Component library management and context feedback
status: implemented
date: 2026-10-19
packages: [core, scene, tools, ui, app]
decisions: [0006, 0028]
---

# 0039 — Component library management and context feedback

## Goal

Complete component deletion, unused-definition management, previews and context feedback after
owner testing of spec 0038. The owner's requested fixes accept this spec.

## Plan

- Keep Delete on a selected scene instance scoped to that instance. Add an explicit sidebar Delete
  action for a definition, removing all of its occurrences, including nested ones, atomically.
  Preserve unrelated definitions and geometry. Undo restores definitions, instances and edit context.
- Detect unused definitions by traversing references reachable from the whole scene. A definition
  referenced only by another unused definition is also unused. Add badges and a Purge unused action;
  preserve every reachable nested definition. Purging and deletion are undoable document commands.
- Show live isometric vector thumbnails in the library, including nested geometry and holes. Reuse
  derived core geometry rather than creating a WebGL renderer per entry. Retain drag placement.
- Add a view-only Highlight components toggle for all component geometry, without selecting it or
  changing history. Entering a context highlights all its descendants, including inner components,
  while other instances remain dimmed and read-only.
- Double-clicking empty space or geometry outside the current context exits one level. Inside
  double-click and primitive selection retain their existing behavior.

## Verification

Regressions cover scene-instance and library deletion, linked/nested occurrence removal, deleted
active contexts, undo/redo, recursive reachability, purge no-ops, nested previews and holes, outside
context exit and descendant highlighting. Browser cases exercise the real sidebar and canvas.
Run headless and browser suites, typecheck and static build, update owning docs and PR #16, and keep
port 5173 available for owner verification. No automatic purge, new dependencies or merge.

## Result

Added document-wide definition deletion and reachability-based purge, with unused badges and exact
undo/redo including removed edit contexts. Scene-instance deletion retains its definition. Added
memoized vector thumbnails, including holes, nested definitions, loose edges, points and empty
placeholders, with correct isometric front-face ordering. Highlight components covers faces, edges,
vertices and rulers; active contexts include their complete descendant subtree. Outside Select
double-click exits one level without changing geometry.

Validation: 207 headless tests and the full 77-case browser suite pass; the final eight component
workflows also pass after thumbnail ordering was corrected. Typecheck and static build pass. Visual
review checked nested-context highlighting and both parent/child library thumbnails. The native-drag
tests now use a direct geometry fixture, while creation keeps real UI coverage; this avoids spending
the whole browser time budget repeating unrelated setup under concurrent WebGL load. No timeout
increase or retry policy was introduced. No dependencies, automatic purge or server features added.
Port 5173 remains available for owner verification. No deviations from product scope.
