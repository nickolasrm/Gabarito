---
id: 0037
title: Partition faces with exact inward offsets
status: implemented
date: 2026-10-18
packages: [geometry, core, tools, ui]
decisions: [0006, 0012, 0027]
supersedes: null
---

# 0037 — Partition faces with exact inward offsets

## Goal

Offset (`O`) creates inner boundaries at a fixed perpendicular distance from a face's edges. A
rectangle inset by X has an X-wide border on every side. The owner explicitly requested this tool.

## Plan

- Click a visible face to start, move inward for a preview, then click to commit; typing a positive
  distance in document units and Enter commits an exact inset. The live distance is the minimum
  distance from the current point in face material to any boundary edge. Selection is not required.
  The original plane and face stay fixed during the operation. Alt bypasses reference snapping.
- Reuse the installed Manifold CrossSection erosion with miter joins, not scaling a bounding box.
  Normalize outer/hole winding in face-local coordinates, inset the material region, and unproject
  all resulting contours. Concave necks may split; holes expand inward into material. Preserve all
  resulting loops and free every WASM object. Fully collapsed offsets fail without changing the model.
- Add an atomic core offset command resolving its source face at execution time. Draw the inset
  contours as shared topology, preserving the original surface and partitioning it into border and
  inner regions; this creates drawing cuts, not a deleted face or an automatic extrusion.
- Preview and command share the same kernel helper. Validate finite positive distances, reject
  missing faces, stale source revisions and invalid topology. One commit is one undo entry.
  Escape, tool changes and blur discard pending previews. No outward offsets or new dependencies.

## Verification and docs

Test exact rectangle distances/areas, triangles/concave shapes, holes, split regions, collapse,
rotated planes, repeated offsets, atomic rollback and exact history. Browser regressions verify
mouse and typed input, displayed distance, parent cuts, extrusion and cancellation. Run all suites,
typecheck and static build. Update public package READMEs, guidance, root status, changelog and
specs index; keep port 5173 running and create a PR for owner verification.

## Result

Implemented Manifold CrossSection erosion in a face-local frame with normalized winding, miter
joins and complete WASM cleanup. Every resulting contour is unprojected into shared drawing topology
through one atomic offset command. Material remains partitioned into border and inner regions;
deleted holes stay erased. Concave splits, expanded holes, rotated faces and repeated insets work.
`offset-tool.ts` keeps its source frame/revision fixed and shares face-reference snapping with Alt
bypass. Outside, collapsed, stale or invalid input cannot mutate the document. Typed values retain
priority, and cancellation clears previews.

Validation: 176 headless tests and 69 Chromium browser tests pass; typecheck and static build pass.
New cases assert rectangle edge distances, triangle miters, concave splits, holes, circle-polygon
offsets, repeated edits, rollback, history, mouse/typed input, vertical surfaces and extrusion. Mouse
browser tests allow one unit for pixel-rounded placement while asserting identical border distances
on every side; typed and headless cases assert geometric precision. Final Circle/Offset UI cases
also pass after the setting-field adjustment. Port 5173 remains available for owner review.
No deviations from the plan.
