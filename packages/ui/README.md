# @gabarito/ui

**Status:** empty — no code yet

## Responsibility

The React chrome around the viewport. Everything that is not 3D.

- Application shell: menu bar, toolbars, status bar, command palette.
- Panels: inspector / entity info, outliner, materials, plugin-contributed panels.
- Dialogs, modals, preference forms.
- Formatting and parsing user-facing values, including display units — the only place millimetres
  become feet and inches or fractions ([decision 0008](../../docs/decisions/0008-units-coordinates-precision.md)).
- The binding of `core` store state to React, through a thin adapter.

## Owns

Presentation and input formatting.

## Must not

- Import `scene` or Three.js. The viewport is a canvas React does not render into
  ([invariant 5](../../docs/architecture/invariants.md)).
- Hold authoritative document state in component state.
- Know about a domain: woodworking panels are contributed by the woodworking plugin.

## Depends on

`@gabarito/core`, `@gabarito/plugin-api`, `react`.

## Read next

[`docs/decisions/0002-language-and-build-toolchain.md`](../../docs/decisions/0002-language-and-build-toolchain.md) ·
[`docs/architecture/plugin-contract.md`](../../docs/architecture/plugin-contract.md)
