---
id: 0033
title: Show shared face-reference hints during rotation
status: implemented
date: 2026-10-18
packages: [tools]
decisions: [0012, 0018, 0020]
supersedes: null
---

# 0033 — Show shared face-reference hints during rotation

## Goal

Rotate shows and snaps to face midpoint alignments, center intersections and diagonals while choosing
A, B and the final angle. The owner's review of PR #13 identified the missing face-interior hints.

## Plan

Reuse `snapOnFace` in the existing inference stage. Resolve Rotate references in its active rotation
plane after A, including explicit pins, and keep the plane frozen after B. Before A, use the
hovered face so a pre-pinned axis does not hide its center reference. Existing vertex/edge/midpoint hits
retain priority. Named feedback, markers and transient reference lines must agree with the endpoint
used for preview and commit. Alt bypasses inference. Keep the existing visibility and hole rules.
Do not add a separate hint system, angle snapping or transform-kernel changes.

## Verification

Headless regressions cover face-center A, aligned B, diagonal angle placement, exact anchor/angle,
preview-only state, history, Alt bypass and constrained-plane priority on horizontal and vertical
faces. Browser regressions assert visible center/diagonal markers and labels, actual committed
coordinates and Alt behavior. Rerun all tests, typecheck and static build; update the tools README,
changelog, specs index and PR #13. Leave port 5173 running for owner verification.

## Result

Rotate now participates in the existing face-reference inference stage. Before A, it uses the
hovered face, including when an axis was pinned first. After A, it uses the active rotation plane;
B still freezes orientation. Center intersections, midpoint alignments and diagonals provide the
same named marker, reference line and exact point as preview and commit. Primitive geometry retains
priority and Alt bypasses inference. No separate snap system or transform changes were added.

Validation: 137 headless tests, 58 Chromium browser tests, typecheck and static build pass.
Regressions assert horizontal/vertical center and diagonal cues, pre-pinned anchor inference,
constrained-plane priority, exact angle/committed coordinates, Alt and history. Cube browser cases
also verify visible face-center markers on top and side faces. Port 5173 remains available for review.
