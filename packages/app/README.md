# @gabarito/app

**Status:** implemented — composition root and global keymap

## Responsibility

The one package allowed to know about everything and wire it together.

- `boot({ root })`: create the store, the viewport, the tool controller and the UI, then connect them.
- Implement `UiApi` by adapting the store, the tool controller and the viewport into the UI's own
  view-model types.
- Install the global keymap.
- Frame the document on start.

## Boot order

1. `createStore()` — the document exists before anything renders.
2. `new Viewport(host, store)` into a detached element, so the canvas can be moved into the layout
   once React has rendered its placeholder.
3. `new ToolController(store, viewport, onChange)` — the viewport is passed as the controller's
   `ViewportAdapter`; the two packages never import each other.
4. `mountUi(root, api)`, then the viewport is appended into the UI's container.
5. `installKeymap`, then `frameDocument()`.

## Keymap

| Key | Action |
|---|---|
| `Space`, `L`, `R`, `C`, `P`, `M`, `Q`, `T`, `Shift+T` | Select, line, rectangle, circle, push/pull, move, rotate, ruler, measure |
| `→` `←` `↑` | Pin X, Y, Z |
| `Shift` + arrow | Pin the opposite direction |
| `↓` | Clear the lock; invert a push/pull |
| `Enter` | Commit the typed value |
| `Esc` | Cancel the operation |
| `Delete` | Delete the selection |
| `Home` | Frame the document |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Undo, redo |

Modal input is offered to the controller before tool shortcuts, so a digit never switches tools.

## Must not

- Contain domain logic, geometry, rendering code, or React components.
- Be imported by another package.

## Dev-only debug handle

In dev builds only, `boot` attaches `window.__gabarito` (store, viewport, active tool) so end-to-end
tests can assert document state rather than pixels. The bundler strips it from production output.
See [`docs/guides/testing.md`](../../docs/guides/testing.md).

## Depends on

Everything except `plugin-host` (not built yet).

## Read next

[`docs/architecture/overview.md`](../../docs/architecture/overview.md)
