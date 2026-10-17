# packages/features

**Status:** empty — no code yet

Domain plugins live here, one package per domain.

```
features/
  woodworking/     packages/features/woodworking
  lighting/        packages/features/lighting
  house/           packages/features/house
```

## Rules for everything in this folder

- Import **only** `@gabarito/plugin-api` ([module boundaries](../../docs/architecture/module-boundaries.md)).
- Never import another feature package. Compose through the host and through document entities.
- Never reach into `core`, `scene`, `tools`, or `ui`. If a feature genuinely needs a capability that
  the plugin API does not expose, that is a **contract change**: write a spec that extends
  `plugin-api`, not a deep import.
- Namespace all persisted data under the plugin `id`
  ([decision 0005](../../docs/decisions/0005-plugin-architecture.md)).
- First-party plugins get no privileged path. They use the same contract as any future third party, so
  the contract is exercised constantly and cannot rot.

## Why this matters

This folder is where the "core is a modeler, not a woodworking tool" promise is kept or broken. Every
convenience import from here into the core is a small step toward a core that only works for one
domain ([decision 0004](../../docs/decisions/0004-repository-layout.md)).

## Read next

[`docs/features/README.md`](../../docs/features/README.md)
