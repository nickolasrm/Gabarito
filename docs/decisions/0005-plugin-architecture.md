---
id: 0005
title: Plugins as the extension mechanism
status: accepted
date: 2026-10-17
tags: [plugins, extensibility, contracts, lazy-loading]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0005 — Plugins as the extension mechanism

## Context

Three known domains will be bolted on later — woodworking, lighting design, house building — and
more will be invented after that. They differ in data (board stock, IES photometric files, wall
assemblies), in tools (dado joints, light placement, wall drawing), and in UI (cut lists, lux
heatmaps, plan sheets).

If each one is built by modifying the core, the core becomes an accretion of special cases, and
adding an unanticipated domain becomes progressively harder — the exact opposite of the goal.

Meanwhile the hosting constraint ([0001](./0001-static-hosting-github-pages.md)) rules out any
server-side plugin registry or dynamic install flow.

## Decision

Every domain capability is a **plugin** implementing the contract in `packages/plugin-api`:

- A plugin is a module exporting a `manifest` and an `activate(context)` function, and it registers
  contributions (tools, commands, entity types, panels, menu items, importers, validators) against
  named slots.
- The host (`packages/plugin-host`) checks `apiVersion` and declared capabilities, succeeds or
  fails **independently per plugin**, and never lets a plugin failure break boot.
- Plugins are loaded via a **build-time manifest plus lazy static chunks**. The manifest is a plain
  data file listing plugin ids and their chunk URLs; `plugin-host` resolves them with a dynamic
  `import()` from the same origin. This is fully static — no server, no upload — and code-splitting
  keeps the initial payload small.
- **Capabilities are declared, not implied.** A plugin states `document.read`, `geometry.solids`,
  `ui.panel`, `storage.*`, and so on. The host can warn or refuse, and users can see what a plugin
  wants before enabling it.
- **Everything a plugin persists is namespaced under its `id`.** Disabling a plugin leaves a valid
  document; documents referencing a missing plugin load with a validator warning, never an error.
- **Plugins never import each other**, and never reach outside `plugin-api`. Interoperation happens
  through the host or through document entities.
- First-party domain features live in `packages/features/*` and use the same contract as any future
  third party. No privileged path exists for them.

## Consequences

**Good:** each domain is added, tested, shipped, and deleted in isolation; the core stays a modeler;
a plugin's blast radius is its own package; first-party and third-party extensions follow one path,
so the contract is exercised constantly and cannot rot; lazy chunks mean users only download the
domains they use; capabilities give a place to reason about trust before third-party plugins exist.

**Bad:** an indirection cost on every feature — nothing can be wired directly, and core capabilities
must first be expressible as contract surface; the contract becomes a public API that needs versioning
discipline, which is real work; a build-time manifest means adding a *third-party* plugin needs at
least a manifest entry, so fully dynamic plugin discovery awaits a later decision; capability
declarations are advisory in the browser — they build trust and structure, not a real sandbox;
several plugins needing the same core idea will each propose contract extensions, adding coordination.

**Neutral:** some things that would be trivially direct in a monolith (a woodworking tool that wants
the lighting plugin's selection) become design conversations; that is the intended friction.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Fork the core per domain | Multiplies maintenance and guarantees divergence. Rule out. |
| Feature flags inside the core | The branch explosion returns under another name, and dead code ships to everyone. |
| `if (feature.woodworking)` conditions in shared code | Directly violates [invariant 8](../architecture/invariants.md). |
| Web components / iframes as the isolation unit | Real isolation, but a poor fit for tools that must share a document and a viewport; iframes cannot participate in picking or inference. |
| Dynamic plugin registry on a server | Impossible without a backend ([0001](./0001-static-hosting-github-pages.md)). |
| Micro-frontends with independent deploys | Overkill now, and adds hosting complexity the project cannot afford. |

## Links

- Contract summary: [`../architecture/plugin-contract.md`](../architecture/plugin-contract.md)
- Related: [0001](./0001-static-hosting-github-pages.md), [0002](./0002-language-and-build-toolchain.md),
  [0004](./0004-repository-layout.md), [0006](./0006-document-model-and-commands.md)
- Feature docs: [`../features/`](../features/README.md)
