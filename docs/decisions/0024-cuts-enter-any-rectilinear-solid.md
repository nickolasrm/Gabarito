---
id: 0024
title: A cut can enter any rectilinear closed solid
status: superseded
date: 2026-10-17
tags: [core, geometry, csg, scope]
supersedes: []
superseded_by: 0025
specs: [0018]
---

# 0024 — A cut can enter any rectilinear closed solid

> **Superseded by [0025](./0025-pull-is-a-union.md) on 2026-10-17.** The one-path rule and the
> measured sweep stand; what 0025 changes is the sweep's side (it follows the drag rather than the
> +axis) and the pull, which becomes a kernel union instead of a prism in face soup — ending the
> "pulling a cavity's floor up still extrudes" ceiling this record accepted.

## Context

The first cut works ([0022](./0022-cuts-run-on-manifold.md)); the second does not. After an opening
is cut, the solid is no longer a box — it has a cavity — and `planCut`'s gate
([0021](./0021-straight-cuts-by-face-surgery.md)'s "is the shell a box of axis-aligned rectangles")
returns nothing, so the tool falls back to *extrude* and stacks faces inside the cavity. Pushing the
recess floor deeper, or cutting a second opening in a cavity wall, is exactly the joinery the product
exists for.

The gate was narrow because the first kernel attempt fed the kernel the document's face soup and was
rightly refused (`ManifoldError`). But a kernel mesh in is not the only way in: the shell of a
**clean** rectilinear solid converts to a manifold mesh directly — every face triangulated, every
edge shared by exactly two faces. And the dimpled solid *is* clean, because the previous cut built it
from kernel output.

## Decision

**`planCut` cuts any rectilinear closed solid by feeding the shell to the kernel as a mesh.**

- The shell (walk unchanged) is repaired the one way it can be dirty: a face drawn **on** another
  face — coplanar and contained — is a marking on the surface, not part of it, and is dropped from
  the mesh input. The larger face stays whole.
- Every remaining face must be an axis-aligned rectangle, or a ring of them (outer plus rectangular
  holes). Anything else is refused with a message.
- `geometry` owns the conversion: weld the loops, triangulate each face (kernel's own `triangulate`
  for a face with holes), orient every triangle outward, `Manifold.ofMesh`. A status other than
  `NoError` is a refusal — "the solid has a flaw the cut cannot pass" — not a wrong solid.
- The cut-or-extrude decision is now measured, not guessed: the tool box is tested against the solid
  with `intersect().volume()`. Material in the sweep → cut; empty sweep → the drag adds material,
  and the tool falls through to the extrusion it always did. This also makes the decision immune to
  how a drawn face happens to be wound.
- The box-only gate, the clamped tool, and the side-of-box sign rule are deleted — the kernel handles
  overshoot, and the measured sweep replaces them.

## Consequences

**Good:** the second cut works wherever it lands — a recess can be deepened, a cavity wall can take a
window, a board can take a second dado, and a rectangle drawn on an already-cut solid cuts too, with
the drawn rectangle becoming the opening; the direction decision is no longer winding-dependent;
roughly eighty lines of box arithmetic leave `core`.

**Bad:** pulling a cavity's floor **up** still extrudes into the cavity, doubling the cavity walls:
adding material inside an existing solid is a union, not an extrusion, and that operation does not
exist here yet.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the box gate, cut cavities by a second box-minus-box from history | Requires replaying the cut history the document does not store. |
| Repair stacked faces by splitting them in the document | Re-introduces the strip arithmetic just deleted in [0023](./0023-faces-hold-holes.md), for a case the kernel already solves. |
| Refuse all second cuts | The reported case. A modeler that cannot deepen a dado cannot do joinery. |

## Links

- Spec: [0018](../specs/0018-second-cut.md)
- Related: [0022](./0022-cuts-run-on-manifold.md) (the kernel and the interface),
  [0023](./0023-faces-hold-holes.md) (faces with holes in the document),
  [0021](./0021-straight-cuts-by-face-surgery.md) (the box gate this supersedes)
