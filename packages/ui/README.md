# ui

React presentation, independent of scene and tools.

`mountUi(root, api: UiApi)` returns an unmount callback. `UiApi` adapts core/store state, tool status,
tool descriptions, viewport attachment and user actions. It is declared in `src/mount.tsx` and
exported through `src/index.ts`.

The shell contains a toolbar, model counts, tool guidance, units, history, status and dimension entry.
It owns no geometry or camera. React mounts the viewport container; app attaches scene's canvas.
Keyboard entry and focused dimension input share the controller's typed buffer.

Tests: browser behavior in `npm run test:e2e`; no snapshot tests for presentation-only components.

The root's `data-tool` selects a crosshair cursor for modeling tools and the default cursor for
Select. Snap marker styles belong to this shell; scene positions their DOM overlay at world targets.

The palette includes Tape Measure (`T`); model counts list user rulers separately from edges.
Midpoint markers use a purple circle. Cursor labels display tape distances in the selected unit and
rectangle aspect hints. These transient overlays have no pointer events and do not intercept drawing.

`UiStatus.snapping` adds a visible `Snapping off · Alt` indicator while bypass is held; tool guidance
explains the modifier. Cursor hints also name face alignments and extrusion reference levels.

Push/Pull guidance describes both click/move/click and hold/drag/release. Active status text supports
both gestures without a separate mode selector. Tape labels include active face-inference names.
