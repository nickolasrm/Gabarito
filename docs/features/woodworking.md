# Woodworking

**Plugin:** `packages/features/woodworking` · **Status:** planned · Uses only
[`plugin-api`](../architecture/plugin-contract.md).

The first domain feature, and the one that shaped the units decision: millimetre precision
([decision 0008](../decisions/0008-units-coordinates-precision.md)).

## What it is for

A woodworker does not want a 3D modeler, they want a **cut list and a build that goes together**. The
model is a means to that end. SketchUp is popular in woodshops precisely because it *almost* does this
and is extended with plugins to finish the job.

## Candidate capabilities

| Capability | Notes |
|---|---|
| Stock library | Named, parameterised material: sheet goods and solid lumber with thickness, finish, and real-world naming ("18 mm birch plywood"). |
| Board entity | A solid with grain direction, thickness, and material — the unit of everything else. |
| Joinery tools | Dado, rabbet, mortise and tenon, dowel, biscuit, pocket screw, dovetail. Each is a parametric cut relative to a reference face. |
| Assembly groups | A group knows its boards, their orientation, and how they meet. |
| Cut list | Per-assembly and project-wide: part, dimensions, material, grain, quantity, and waste factor. |
| Layout / nesting | Arrange parts on sheet goods with grain constraints, and export a print-ready sheet. |
| Hardware and fasteners | Library of screws, hinges, slides, with drilling positions. |
| Dimensioning | Woodworking-neutral dimension entities live in the core; the *format* (fractions, mm, board-thickness callouts) is this plugin's concern. |
| Export | CSV and PDF cut lists; DXF for CNC. |

## Why it needs the contract to be good

Nothing here is a modeler feature. Every item is: a new entity type (board), new commands (cut a
dado), new tools, a new panel (cut list), a new exporter, and namespaced material data. If any of
those requires editing `core`, the contract has a gap and the fix belongs in `plugin-api` as a spec —
not in this package as a shortcut.

## Open questions to settle in a spec

- Is the cut list computed from the model, or maintained as data the model feeds? (Performance and
  trust differ.)
- How are joinery operations expressed so they survive edits to the parent board — fully parametric,
  or baked geometry with a link?
- Where does material data live: in the document, in an app-level profile, or both?
- How much should grain direction constrain layout nesting, and how is it shown?

Related: [feature modules](./README.md), [units decision](../decisions/0008-units-coordinates-precision.md),
[plugin contract](../architecture/plugin-contract.md).
