---
id: 0018
title: A second cut can enter a cut solid
status: implemented
date: 2026-10-17
packages: [core, geometry, tools]
decisions: [0024]
supersedes: null
---

# 0018 — A second cut can enter a cut solid

## Goal

After an opening is cut, the solid has a cavity and is no longer a box. Pushing the cavity's floor
deeper, or cutting into a cavity wall, must cut — the first cut's result is the second cut's input,
which is what joinery is.

## Why now

The owner's browser check of [0016](../specs/0016-cut-holes-with-push-pull.md) cut once successfully,
then pushed the cavity's floor and got an extrusion stacked inside the cavity: `planCut`'s box gate
could no longer read the solid. [Decision 0024](../decisions/0024-cuts-enter-any-rectilinear-solid.md)
replaces the gate with the shell itself, fed to the kernel as a mesh.

## Scope

**In scope**

- `geometry`: `subtractShell` — a shell of loops (rectangles, and rings of rectangles) welded,
  triangulated (the kernel's own triangulator where a face has holes), oriented outward, `ofMesh`,
  validated, and subtracted by the tool box. Returns the cut mesh, or nothing when the sweep misses
  the solid.
- The one repair the shell can need: a face drawn **on** a coplanar larger face is dropped from the
  mesh input — it is a marking on the surface, and the larger face is the surface. This covers drawn
  faces on plain boxes **and** on already-cut solids.
- `core`: `planCut` routes every shell through `subtractShell`; the box gate, the clamped tool and
  the side-of-box sign rule are deleted; refusals keep their messages.
- Tests: deepen a recess, cut a window in a cavity wall, a drawn face on a cut solid, cut through
  again, and the refused cases.

**Out of scope**

- Pulling a cavity's floor **up**: still the extrusion path, which doubles the cavity walls. Adding
  material inside an existing solid is a union; no union tool exists yet.
- Non-rectilinear or non-axis-aligned solids, as before.

## Plan

1. `geometry`: `withHoles(outer, holes)` — kernel `triangulate` over projected loops, oriented to
   the face's winding; `subtractShell(shell, tool)` — weld, triangulate, `ofMesh` with a status
   refusal, `intersect` volume to decide cut against extrude, `subtract`, validate closed.
2. `core`: shell repair (drop contained coplanar faces), rectilinear validation of every loop,
   `planCut` on the new path; delete `asAxisAlignedBox` and the tool arithmetic around it.
3. `tools`: unchanged — the `{kind: "cut" | "extrude" | "refuse"}` contract already carries it.
4. Tests at each layer, then the browser pass: deepen the recess, cut a second opening.

## Design notes

**Why the sweep decides.** The old rule read the drag against the box's sides; the floor of a cavity
is on no box side. The kernel answers the real question — is there material in the sweep? — with a
volume, and the answer is immune to how the pushed face is wound, which the document never promised.

**Why dropping drawn faces is safe.** A face stacked coplanar inside a larger face adds no surface:
the solid's boundary at that plane is the larger face's region. The marking survives in the document;
only the mesh input skips it, and the cut that comes back is region-true because the tool is the
pushed face's rectangle either way. The cut removes the whole shell it walked — markings included —
and replaces it with the kernel's faces, so the drawn rectangle goes into the opening it created,
which is what the user meant.

## Risks

| Risk | Mitigation |
|---|---|
| `ofMesh` rejecting a shell the walk accepted | Status is checked and becomes a refusal with the flaw message; the document is untouched. |
| A sweep that grazes the solid counting as material | The overlap is a volume; grazes are far below the threshold and fall through to extrude, exactly as a zero-depth drag does. |
| Winding drift through triangulation | Every triangle is oriented against its face's own normal before the kernel sees it. |

## Verification

- [ ] Deepen the recess: closed, volume = box − first cut − second cut
- [ ] A window in a cavity wall leaves a ring on that wall
- [ ] A face drawn on a cut solid cuts, and the drawn rectangle ends up as the opening
- [ ] The first cut's tests stay green (rings, through cut, undo exact)
- [ ] Unit and e2e suites pass; static build stays serverless

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/decisions/README.md`
- [ ] `packages/{core,geometry}/README.md`
- [ ] `docs/features/sketchup-core.md` (push/pull ceilings)

## Result

Shipped as planned: one path, no box gate. Two findings from the implementation, both recorded in
[0024](../decisions/0024-cuts-enter-any-rectilinear-solid.md) as amended:

- The kernel's own `triangulate` reads a hole as a hole only when the hole contour winds **against**
  the outer one. Document hole loops are wound the same way as their outer loop (they come from the
  kernel mesh's boundary direction), so `subtractShell` reverses them before projecting.
- A loop that bounds a rectangle with subdivided edges (a seam vertex mid-edge, left where two cut
  levels met) is still a rectangle: the check is "every point on one of the four edges", not "every
  point on two".

Pushing a cavity wall's whole face inward extends the cavity — the face moves, no ring — which
matches the behaviour this product is inspired by; the ring case is a drawn window, tested separately.
112 unit tests, 23 e2e, typecheck clean, static build unchanged.
