---
id: 0019
title: Pull is a union, and the sweep follows the drag
status: implemented
date: 2026-10-17
packages: [core, geometry, tools]
decisions: [0025]
supersedes: null
---

# 0019 — Pull is a union, and the sweep follows the drag

## Goal

On any solid, whatever its faces' windings: the push cuts where the cursor pushed, the pull adds
where the cursor pulled — and pulling a cavity's floor up fills the cavity, SketchUp-style.

## Why now

The owner's third report on the same flow: a push after the first cut carved the hole on the other
side, a pull then carved it correctly, and after three cycles push/pull went silent. Two bugs and a
silent fallback ([decision 0025](../decisions/0025-pull-is-a-union.md)) — all of them trust placed in
the face winding the document never promised.

## Scope

**In scope**

- `geometry`: `sweepShell(shell, tool)` → `{ verb: "cut" | "add", mesh }` — one kernel pass: the
  sweep's overlap with the solid is measured; material → subtract, empty → union; both validated.
  Replaces `subtractShell` (which keeps existing tests green until replaced here).
- The sweep's side follows the face's winding (signed against its own axis) — the side the preview
  already shows.
- `core`: `planCut` returns `{ kind: "cut" | "add", remove, add }` from the kernel; `extrude` remains
  only when there is no solid at all.
- `core`: `buildExtrusion` reuses existing offset points instead of returning empty.
- `tools`: push/pull dispatches `cut` and `add` the same way and names the verb in the readout.

**Out of scope**

- Pulling one solid's face onto another solid: refused by the kernel (coplanar doubling), because
  merging separate solids is not an operation here yet.
- Repairing solids corrupted before this change: undo, or redraw.

## Plan

1. `geometry`: `sweepShell` — the shell mesh from [0018](../specs/0018-second-cut.md), the measured
   overlap, `subtract` or `union`, the closedness validation, the verb out.
2. `core`: the sweep's side signed by the face's winding; `planCut`'s three outcomes; the extrusion
   point-reuse fix.
3. `tools`: the push/pull branches and the readout verb.
4. Tests: an inverted-wound drawn face cuts on the right side; a bottom face pushes up into the
   solid; the recess floor pulled to the rim closes the cavity; the pull out adds with a ring on the
   host face; the extrusion reuses points; the existing cut tests stay green.

## Design notes

**Why the union replaces the prism-in-face-soup.** A prism built by hand on top of a solid leaves
the host face whole beneath it — edges used once, doubled coplanar walls — and every later cut meets
that as a refusal. The union returns the whole surface at once: host ringed, walls trimmed, closed by
guarantee.

**Why the sweep follows the winding instead of the +axis.** The preview already does — it moves the
face along its own normal. The sweep matching the preview is the whole fix; any other convention is a
second sign to get wrong.

## Risks

| Risk | Mitigation |
|---|---|
| The union leaving a doubled face where the prism meets the host | It cannot: the kernel consumes the contact; the host comes back ringed. |
| The verb mislabeled in the readout | The verb rides in the plan; the readout prints it verbatim. |
| Old corrupted solids refusing forever | The refusal names the flaw; undo or redraw. Recorded in [0025](../decisions/0025-pull-is-a-union.md). |

## Verification

- [ ] A drawn face wound backwards cuts on the side it was pushed, not the far side
- [ ] The box's bottom face pushes up into the solid
- [ ] The recess floor pulled to the rim fills the cavity exactly (no ring, no doubled walls)
- [ ] The pull out adds material and leaves the host ringed, every edge shared twice
- [ ] The extrusion reuses an existing point instead of doing nothing
- [ ] The cut tests from [0016](../specs/0016-cut-holes-with-push-pull.md) and
      [0018](../specs/0018-second-cut.md) stay green; e2e passes; build stays static

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/decisions/README.md`
- [ ] `packages/{core,geometry}/README.md`, `docs/features/sketchup-core.md`

## Result

Shipped as planned. One addition: the kernel's instance method for the union is `add` (`union` is the
static form) — noted here so the next reader does not trip on it as this one did.

The push/pull tool's readout now prints the verb the plan carried (`cut` or `add`), and the
`extrude` kind survives only for the no-solid case. 116 unit tests, 23 e2e, typecheck clean, static
build unchanged.
