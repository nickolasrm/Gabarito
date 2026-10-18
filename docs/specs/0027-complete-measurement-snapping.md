---
id: 0027
title: Complete measurement previews and constrained snapping
status: implemented
date: 2026-10-18
packages: [tools, scene, app, ui]
decisions: [0012, 0014, 0018, 0020, 0027]
supersedes: null
---

# 0027 — Complete measurement previews and constrained snapping

## Goal

Complete the owner's review corrections in PR #11: snap real dimensions, show prospective rulers,
infer face-layout references, bypass snapping with Alt, and match push/pull depth to visible targets.
The owner's report authorizes this follow-up before merge.

## Behavior

- A midpoint retains its source edge identity. Tape rulers from midpoints remain parallel to that
  edge, including when a midpoint is represented as a virtual point.
- Tape preview shows both the finite measurement segment and the prospective infinite dashed ruler.
  Only second-click completion or drag release writes a ruler entity; cancellation clears both.
- Rectangle proportions snap to exact square/integer ratios within a screen-space tolerance. Preview
  and commit share the snapped endpoint; typed dimensions always override proximity inference.
- Within a supporting face, drawing infers perpendicular lines from edge midpoints and quadrilateral
  diagonals, including rotated faces. Near their intersections, snap both coordinates. For a 100×100
  face, rectangle (30,30) to (40,49) should end at (40,50). Show the reference line and label.
- Visible explicit geometry targets take priority over inferred face layout and proportions.
  Occluded references and holes never become false material targets.
- Holding Alt bypasses point, guide, midpoint, face-layout, proportion, automatic axis and extrusion
  target snapping. Preserve the support plane, explicit axis locks and exact typed input. Key release
  restores snapping immediately; blur clears the held modifier state.
- Push/pull can match the elevation of a hovered vertex/edge and a nearby intersecting face plane.
  Keep the extrusion axis fixed and show the referenced target and connecting inference line.
  Face-plane snaps use proximity and exclude the active face; never jump to an unrelated plane.

## Plan

Use focused headless inference helpers in tools, with projection and visibility supplied by ToolView.
Retain source provenance on snap hits. Extend existing ruler previews and pointer/keyboard routing;
keep topology and the geometry kernel unchanged. Update affected READMEs, index and changelog.

## Verification

Add regressions for midpoint provenance, preview without mutation, exact ratios and typed override,
the owner's (40,49) case, rotated/holed face references, diagonals, visibility, Alt down/up/blur and
push/pull reference depth. Cover actual browser gestures and commits, not labels alone. Run the full
headless/browser suites, typecheck and static build; keep port 5173 available for owner review.

## Result

- Fixed a reproduced identity conflict: near-coincident ruler intersections could beat an edge
  midpoint and turn it into a vertex. Midpoint picks now retain edge provenance; tools also resolve
  source edges for virtual midpoint hits.
- Tape previews the same infinite ruler direction/position it commits. Proportion inference now
  snaps actual rectangle dimensions within eight screen pixels, with exact typed overrides.
- Added focused face-layout and extrusion inference helpers. Midpoint alignments, quadrilateral
  diagonals and reference intersections work in face coordinates and reject holes/hidden points.
- Alt bypass updates immediately on key down/up and pointer events; blur restores snapping.
- Push/pull matches vertex/edge levels and nearby face planes. Added proximity for zero-level
  targets after free-drag regressions caught unwanted resets to the starting plane.
- All 106 headless tests and 40 browser tests pass, including the owner's exact drawing example,
  Alt raw dimensions, exact ratio commits, three extrusion reference kinds and earlier free drags.
  Typecheck and static build pass. Chromium visual review confirms the dashed ruler preview.
- No dependencies, core topology or kernel changes. PR #11 remains open for owner review at 5173.
