# Plugin contract

The shape of a Gabarito plugin. Types live in `packages/plugin-api`; this page is the summary an
agent reads before writing a feature. The normative source is the package's `README.md` and the
types themselves.

## What a plugin is

A module that declares who it is, what it needs, and what it contributes — then waits to be
activated. It is loaded lazily by `plugin-host` from a static chunk, so it works on GitHub Pages.

## Declaration

```ts
export const manifest: PluginManifest = {
  id: "gabarito.woodworking",           // reverse-DNS, globally unique, namespaces stored data
  name: "Woodworking",
  version: "0.1.0",
  apiVersion: "^1",                     // plugin-api version this plugin was written against
  capabilities: ["document.read", "document.write", "ui.panel", "geometry.solids"],
  documentSchema: "gabarito.woodworking/1",  // version of the data it writes into documents
  dependsOn: [],                        // other plugin ids, by id only
};
```

## Lifecycle

```ts
export function activate(context: PluginContext): PluginInstance  // register contributions
// PluginInstance.dispose()  — undo registrations; must not mutate the document
```

`activate` runs once, after the document store exists. `dispose` is called when the plugin is
disabled and must leave the document valid and loadable.

## What a plugin may contribute

| Contribution | Contract |
|---|---|
| **Tools** | interaction state machines registered under a tool id |
| **Commands** | document mutations, named and namespaced |
| **Entity types** | new document entity kinds, with serialisation and defaults |
| **UI panels** | React panel slots: inspector, sidebar, bottom dock |
| **Menu items / shortcuts** | named commands bound to UI entry points |
| **Inspectors** | property editors for the entity types the plugin owns |
| **Import/export** | file format readers and writers |
| **Validators** | warnings on document load (missing material, invalid assembly, …) |
| **Settings** | namespaced, persisted with the document or the app profile |

## Hard rules

1. **Namespacing.** Everything a plugin persists lives under its `id`. Removing the plugin must
   leave the rest of the document untouched.
2. **No direct imports between plugins.** Communicate through the host or through document entities.
3. **No core edits.** A plugin cannot add ideas to `core`; if it needs one, it proposes a contract
   change with a spec.
4. **Graceful absence.** Documents referencing a disabled plugin load with a validator warning,
   never an error.
5. **Versioning.** `apiVersion` is checked before activation; incompatible plugins are skipped with
   a visible message rather than crashing boot.
6. **Lazy is the default.** A plugin's bundle must not be part of the initial payload.

## Where plugins live

| Kind | Location |
|---|---|
| First-party domain features | `packages/features/<name>/` |
| Built-in core-ish tools (select, line…) | `packages/tools/` — not a plugin |
| Third-party | out of tree; still loaded through the same manifest |

Related: [decision 0005](../decisions/0005-plugin-architecture.md),
[decision 0011](../decisions/0011-geometry-kernel-strategy.md),
[`../features/`](../features/README.md).
