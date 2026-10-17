# @gabarito/app

**Status:** empty — no code yet

## Responsibility

The composition root: the one package allowed to know about everything and wire it together.

- `boot()`: create the document store, the viewport, and the UI, and connect them.
- Build the plugin manifest and hand it to `plugin-host`.
- Register the built-in tools from `@gabarito/tools`.
- Default keymap and command bindings.
- Application-level settings and profile (theme, display units, autosave interval).
- Error boundaries and the "something went wrong, here is your document" recovery path — important
  when there is no server to blame.

## Owns

Wiring, boot order, and the built-in composition. Nothing else.

## Must not

- Contain domain logic, geometry, rendering code, or React components.
- Be imported by any other package. It is the top of the dependency graph, under `apps/web`.
- Reimplement anything a library package already provides. If composition needs a capability, the
  owning package should expose it.

## Depends on

`@gabarito/core`, `@gabarito/geometry`, `@gabarito/scene`, `@gabarito/tools`, `@gabarito/ui`,
`@gabarito/persistence`, `@gabarito/plugin-api`, `@gabarito/plugin-host`.

## Read next

[`docs/architecture/overview.md`](../../docs/architecture/overview.md)
