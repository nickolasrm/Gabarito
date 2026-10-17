# @gabarito/ui

**Status:** implemented — toolbar, settings panel, status bar, 3D labels

## Responsibility

The React chrome around the viewport. Everything that is not 3D.

- Toolbar: one button per tool, plus undo, redo, delete and frame.
- Settings panel: unit selection, the snapping toggle, circle segment count, key reference.
- Status bar: current tool, hint, axis lock, snap hint, live measurement, and the typed-value buffer.
- Labels: dimension text positioned by projecting through the viewport.

## Public interface

```ts
mountUi(root: HTMLElement, api: UiApi): void

interface UiApi {
  store: Store;                        // core, for settings and selection
  tools: ToolButton[];
  status(): UiStatus;                  // everything the status bar shows
  labels(): LabelItem[];               // already projected to screen coordinates
  subscribe(listener): () => void;     // fires on any change the UI should show
  attachViewport(container): void;     // where the canvas goes
  selectTool, setUnit, setSnapping, setCircleSegments,
  undo, redo, deleteSelection, frameAll
}
```

The UI owns its view-model types and never imports `tools` or `scene`; `app` adapts both into
`UiApi`. That is what keeps React out of the render loop and the tools out of React
([module boundaries](../../docs/architecture/module-boundaries.md)).

## Owns

Presentation, and the formatting of user-facing values — the one place millimetres become a display
unit ([decision 0008](../../docs/decisions/0008-units-coordinates-precision.md)).

## Must not

- Import `scene` or Three.js; the viewport is a canvas React never renders into.
- Hold authoritative document state in component state.

## Depends on

`@gabarito/core`, `react`.

## Read next

[`docs/specs/0005-units-and-measurement.md`](../../docs/specs/0005-units-and-measurement.md)
