# @gabarito/plugin-api

**Status:** empty — no code yet

## Responsibility

The contract. Types and constants only — no behaviour, no dependencies.

- `PluginManifest`: id, name, version, `apiVersion`, capabilities, document schema, dependencies.
- `PluginContext` and `PluginInstance`: what `activate` receives and returns.
- Contribution shapes: tools, commands, entity types, panels, menu items, inspectors, importers,
  validators, settings.
- Capability names and the `apiVersion` compatibility rules.
- Documentation of the stability promise: what may change in a minor version, and what requires a
  major one.

## Owns

The shape of every extension point in the product. This package is the public API of Gabarito.

## Must not

- Import **anything**, including the rest of Gabarito. A contract that depends on an implementation is
  not a contract ([invariant 9](../../docs/architecture/invariants.md)).
- Contain runtime logic beyond type guards and small pure helpers.
- Include anything that would only exist to make one particular plugin work.

## Public interface

This package *is* the public interface, so its summary is
[`docs/architecture/plugin-contract.md`](../../docs/architecture/plugin-contract.md). The types
themselves become the normative source once written.

## Depends on

Nothing.

## Read next

[`docs/decisions/0005-plugin-architecture.md`](../../docs/decisions/0005-plugin-architecture.md) ·
[`docs/architecture/plugin-contract.md`](../../docs/architecture/plugin-contract.md)
