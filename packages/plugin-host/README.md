# @gabarito/plugin-host

**Status:** empty — no code yet

## Responsibility

Turning manifests into running plugins, safely.

- Reading the plugin manifest and resolving each plugin's static chunk with a dynamic `import()`.
- `apiVersion` compatibility checks before activation.
- Capability checks and reporting.
- Activation and disposal lifecycle, in dependency order.
- **Containment:** a plugin that throws during activation or use degrades only itself. Boot never fails
  because of one plugin ([decision 0005](../../docs/decisions/0005-plugin-architecture.md)).
- Discovery of contributions: tools, commands, entity types, panels, validators.
- Validation on document load: warn about data belonging to a disabled plugin, never error
  ([invariant 10](../../docs/architecture/invariants.md)).

## Owns

The lifecycle and the containment guarantees. Not the contract itself.

## Must not

- Import any feature package. The host knows plugins only through `plugin-api` types and the manifest.
- Grant capabilities — nothing here is a real sandbox, and pretending otherwise would be worse than
  being honest that capabilities build structure and trust.
- Inline any plugin's code into the initial bundle; all plugins load lazily.

## Depends on

`@gabarito/plugin-api`.

## Read next

[`docs/decisions/0005-plugin-architecture.md`](../../docs/decisions/0005-plugin-architecture.md) ·
[`docs/architecture/plugin-contract.md`](../../docs/architecture/plugin-contract.md)
