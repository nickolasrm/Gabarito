# @gabarito/tools

**Status:** implemented — nine tools, shared typed input, inference engine

## Responsibility

Turning input into commands. Tools never mutate the document: they emit commands and the store
applies them ([invariant 6](../../docs/architecture/invariants.md)).

## The tool contract

A tool is a small state machine over `idle → first point → live → commit`. All methods are optional:

```ts
interface Tool {
  id; label; shortcut; hint;
  numbers?: { kind: "length" | "angle"; max: number; example: string; labels: string[] };
  activate; deactivate; cancel;
  pointerDown; pointerMove; pointerUp;
  commitNumbers(values, ctx);      // already parsed in the current unit
  readout(ctx); isActive(ctx); axisAnchor(ctx); invertDirection(ctx);
}
```

Typed values and axis locks are handled by `ToolController`, not by each tool
([decision 0012](../../docs/decisions/0012-tool-input-model.md)). A tool declares how many numbers it
accepts; it never sees raw text.

## Tools

| Tool | Shortcut | Typed value |
|---|---|---|
| Select | `Space` | — |
| Line | `L` | `100` (length) |
| Rectangle | `R` | `100, 50` or `100` (square) |
| Circle | `C` | `10` (radius) |
| Push/Pull | `P` | `50` (distance; into a solid cuts, away adds) |
| Move | `M` | `100` (distance) |
| Rotate | `Q` | `45` (degrees) |
| Ruler | `T` | `300` (guide offset) |
| Measure | `Shift+T` | `100` (length) |

## Inference

`resolveSnap` gathers candidates from the document plus virtual geometry — guides snap as edges, and
guide∩guide, edge∩guide and edge∩edge crossings snap as virtual vertices
([spec 0006](../../docs/specs/0006-snapping-inference-axis-locks.md)). Snaps to real geometry always
win over an inferred axis. Tolerance is expressed in screen pixels, so snapping feels the same at
every zoom level.

## Public interface

```ts
ToolController(store, viewport, onChange)
  setTool, getActiveTool, getActiveToolId, getToolMeta,
  pointerDown, pointerMove, pointerUp, pointerLeave,
  typedKey, commitTyped, pressKey, cancel,
  getPreview, getSnapIndicator, getStatus
resolveSnap(input)        the inference engine
createAxisLock, projectOntoAxis, axisForArrow
createTools(), TOOL_ORDER
```

## Must not

- Import Three.js or `@gabarito/scene`. The viewport arrives as the `ViewportAdapter` interface
  declared here and matched structurally by `app`.
- Hold authoritative state: a tool's in-flight draft is provisional.

## Depends on

`@gabarito/core`, `@gabarito/geometry`.

## Test

`npm test` — inference unit tests plus `controller.test.ts`, which drives every tool with synthetic
pointer input and asserts the resulting document.

## Read next

[`docs/specs/0007-drawing-and-transform-tools.md`](../../docs/specs/0007-drawing-and-transform-tools.md)
