---
id: 0009
title: Let core depend on geometry
status: implemented
date: 2026-10-17
packages: [core, geometry]
decisions: [0015, 0004]
supersedes: null
---

# 0009 — Let core depend on geometry

## Goal

Change the packaging boundary so `core` can import `@gabarito/geometry`, and update the normative
documents that say otherwise.

## Why now

The first construct operations in [spec 0004](./0004-core-document-geometry-viewport.md) — face normals
for extrusion, document bounds, planarity checks — are geometry, and `core` needs them. The rule as
written forbids it, and
[`module-boundaries.md`](../architecture/module-boundaries.md) requires a recorded change rather than a
quiet exception.

## Scope

**In scope**

- [Decision 0015](../decisions/0015-core-depends-on-geometry.md) recording the new rule.
- Updating `docs/architecture/module-boundaries.md`: the arrow diagram, the rules table, and the
  "imports nothing" statements.
- Updating `docs/decisions/README.md` and `packages/core/README.md` to match.

**Out of scope**

- Any other boundary change. `geometry` and `plugin-api` stay leaves.
- Moving state into `geometry`, or geometry operations into `core`.

## Plan

1. Write decision 0015.
2. Edit `module-boundaries.md`: geometry and plugin-api are the leaves; `core → geometry` is allowed.
3. Edit `packages/core/README.md`: dependency list and the note about re-exporting geometry types.
4. Keep the boundary test asserting `geometry` has no in-repo imports, and add one asserting `core`
   imports only `geometry`.

## Design notes

The distinction the docs were missing is between a **leaf** (imports nothing, no state) and a
**foundation** (imports only leaves). `geometry` is a leaf; `core` is a foundation. Naming that
difference is the whole change.

## Risks

| Risk | Mitigation |
|---|---|
| The rule drifts again because the diagram is not consulted | The boundary test enforces it, so a violation fails CI rather than review. |
| `core` accumulating more dependencies | The test asserts the exact allowed set, so any new import is a deliberate, recorded change. |

## Verification

- [ ] `module-boundaries.md` matches the implemented dependency direction
- [ ] A test fails if `geometry` imports any in-repo package
- [ ] A test fails if `core` imports anything other than `geometry`
- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/decisions/README.md` updated

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/decisions/README.md`
- [ ] `docs/architecture/module-boundaries.md`
- [ ] `packages/core/README.md`

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** [decision 0015](../decisions/0015-core-depends-on-geometry.md), the updated
  [`module-boundaries.md`](../architecture/module-boundaries.md) with a leaf/foundation distinction,
  the updated `packages/core/README.md`, and two boundary tests: one asserting `geometry` has no
  in-repo imports, one asserting `core` imports only `geometry`.
- **Deviations from the plan:** none.
- **Follow-up specs:** none. Whether `persistence` should sit beside `core` remains open, as 0015
  notes.
