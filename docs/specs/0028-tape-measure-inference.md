---
id: 0028
title: Apply shared face snapping to Tape Measure
status: implemented
date: 2026-10-18
packages: [tools]
decisions: [0012, 0014, 0020]
supersedes: null
---

# 0028 — Apply shared face snapping to Tape Measure

## Goal

Tape Measure must use the same face midpoint, diagonal and reference-intersection snaps as Line
and Rectangle. The owner's bug report authorizes this fix.

## Plan

- Include tape in the existing shared face-inference path, without another snapping implementation.
- Infer on the actually hovered face when measuring across faces with different support planes.
- Include the shared automatic axis inference used by Line over empty space.
- Preview and commit use the same snapped endpoint in click/click and drag/release modes.
- Display the inference line/name alongside distance and the infinite ruler preview.
- Preserve explicit point/edge/guide priority, midpoint ruler orientation, Alt bypass, numeric input
  and one-step history. Rectangle proportion snapping remains specific to rectangles.

## Verification

Add headless and browser regressions for both gestures, exact guide coordinates, face diagonals,
reference intersections, different target planes, Alt bypass and history. Existing raw-distance
browser checks should explicitly hold Alt when intentionally measuring without inference.
Run full headless/browser suites, typecheck and static build. Leave port 5173 running for review.

## Result

- Tape uses the existing face resolver, including the actually hovered target plane for cross-face
  measurements, and Line's empty-space automatic axis inference. Explicit pins keep priority.
- Distance labels now include inference names; reference lines accompany the ruler preview.
- Headless tests cover both gestures, midpoint/diagonal/intersection targets, cross-plane targets,
  Alt bypass, previews, exact guide endpoints and history. Browser tests check actual committed
  midpoint/diagonal rulers and undo/redo in both gestures.
- Raw-distance browser checks explicitly hold Alt when inference is intentionally bypassed.
- All 114 headless tests and 49 browser tests pass; typecheck and static build pass.
- No new dependency or core/kernel changes. Preview remains at port 5173 for owner review.
