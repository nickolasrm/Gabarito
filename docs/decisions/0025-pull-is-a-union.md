---
id: 0025
title: The sweep follows the drag, and pull is a union
status: accepted
date: 2026-10-17
tags: [core, geometry, csg, tools]
supersedes: [0024]
superseded_by: null
specs: [0019]
---

# 0025 — The sweep follows the drag, and pull is a union

## Context

After [0024](./0024-cuts-enter-any-rectilinear-solid.md) any rectilinear solid can be cut, and the
first reported flow works — but the owner then hit three symptoms on the same cube: a push carved on
the **other side**; pulling then carved correctly; after three cycles, push/pull stopped doing
anything at all. All three trace to trust placed where the document offers none:

- The sweep interval runs along the face's **positive axis**. A face whose outward normal points
  along the negative axis — a bottom face, or a drawn rectangle wound the other way — has its push
  and pull **swapped**: the push sweeps empty space and the pull sweeps material.
- When the sweep misses, the tool falls through to `buildExtrusion`, which builds a prism from face
  soup. Pulled over or into existing material it stacks internal and doubled faces — the later
  `ofMesh` refusal ("the solid has a flaw") is exactly that corruption coming back.
- `buildExtrusion` returns empty when any offset point already exists — common after cuts — and
  push/pull dispatches the empty result in silence.

## Decision

**The sweep follows the drag, and the drag's two directions are subtract and union — both through
the kernel.**

- The sweep (and the prism, which is the same box) is laid on the side the preview shows: the face's
  winding direction, signed against its own axis. Push and pull now mean what the cursor did,
  whatever the winding.
- Sweep hits material → `subtract`. Sweep misses → **`union`**: the prism merges with the solid and
  the kernel returns the whole surface — the cavity walls a fill would have doubled are trimmed by
  the union, so pulling a cavity's floor to the rim closes the cavity exactly. The result converts
  through the same loops pipeline; the shell the walk found is replaced wholesale.
- The plan reports `cut` or `add` for the kernel results; `extrude` remains only for the case with
  no solid at all — a lone face, where the prism needs no kernel and no boolean.
- `buildExtrusion` reuses existing points at the offset plane instead of refusing; silence is not a
  behaviour.

## Consequences

**Good:** a push cannot land on the far side; a pull cannot stack a prism inside a solid; the fill
case (pull the recess floor up) is correct instead of doubled; a refusal is the only silence left.

**Bad:** pulling one solid's face **onto another solid** shares corners but does not merge the two —
the coplanar doubling is refused by the kernel with the flaw message, and merging solids is still an
operation that does not exist here. And an extrusion that once landed internally keeps a solid
unusable until it is undone — the corruption from before this decision does not heal itself.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep `buildExtrusion` for pulls, trim doubled walls by hand | That is a union operation written in face soup — the kernel does it and guarantees the result. |
| Keep the +axis sweep and teach the tool to invert the drag per face | Same behaviour, one more sign convention to get wrong. |
| Leave the silent empty extrusion | The reported "stopped working at all". |

## Links

- Spec: [0019](../specs/0019-pull-is-a-union.md)
- Supersedes: [0024](./0024-cuts-enter-any-rectilinear-solid.md)
- Related: [0022](./0022-cuts-run-on-manifold.md) (the kernel interface),
  [0023](./0023-faces-hold-holes.md) (the rings the union leaves behind)
