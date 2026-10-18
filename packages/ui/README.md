# ui

React presentation, independent of scene and tools.

`mountUi(root, api: UiApi)` returns an unmount callback. `UiApi` adapts core/store state, tool status,
tool descriptions, viewport attachment and user actions. It is declared in `src/mount.tsx` and
exported through `src/index.ts`.

The shell contains a toolbar, model counts, tool guidance, units, history, status and dimension entry.
It owns no geometry or camera. React mounts the viewport container; app attaches scene's canvas.
Keyboard entry and focused dimension input share the controller's typed buffer.

Tests: browser behavior in `npm run test:e2e`; no snapshot tests for presentation-only components.
