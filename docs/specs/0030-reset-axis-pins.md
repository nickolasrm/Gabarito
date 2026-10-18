---
id: 0030
title: Clear axis pins when a tool operation ends
status: implemented
date: 2026-10-18
packages: [tools]
decisions: [0012, 0018]
supersedes: null
---

# 0030 — Clear axis pins when a tool operation ends

## Goal

Axis pins must not leak into the next operation. The owner's bug report confirms the reset behavior
already required by decision 0012: completion, Escape and tool changes clear the pin.

## Plan

Reset axis and sign in the shared cancellation path used by completed operations and interruptions.
A committed line segment also clears its pin while retaining the polygon chain. Keep an explicitly
chosen pin active throughout an unfinished click-mode or drag-mode operation, including typed input.

## Verification

Headless tests cover successful commits, chained line segments, Escape, tool changes and reset of
negative-Z sign. Browser tests check pin indicators and unconstrained next-operation geometry after
completion and Escape. Run all tests, typecheck and static build.

## Result

- The shared cancellation/completion path resets axis and sign. A successful line segment also
  clears its pin while keeping the polygon chain active. Tool changes and Escape clear the lock.
- Active explicit pins take priority over face inference, preventing off-axis endpoints.
- Headless and browser regressions cover completion, chained segments, Escape, tool switches,
  negative-Z reset and the next operation's geometry. Existing pin-toggle tests now verify the
  required automatic clear before testing a new pin's manual toggle.
- All 114 headless tests and 49 browser tests pass; typecheck and static build pass.
- No new dependency or core/kernel changes. Preview remains at port 5173 for owner review.
