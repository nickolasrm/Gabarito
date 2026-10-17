# Feature modules

The domains Gabarito grows into. Each one is a **plugin** — see
[decision 0005](../decisions/0005-plugin-architecture.md) and the
[plugin contract](../architecture/plugin-contract.md). None of them exist yet.

Read only the file for the domain you are touching. The core does not know any of these words, and
must not learn them from you.

| Feature | Package | File | Status |
|---|---|---|---|
| SketchUp-like core modeling | `packages/tools`, `packages/core` | [`sketchup-core.md`](./sketchup-core.md) | planned — the first thing built |
| Woodworking | `packages/features/woodworking` | [`woodworking.md`](./woodworking.md) | planned |
| Lighting design | `packages/features/lighting` | [`lighting-design.md`](./lighting-design.md) | planned |
| House building | `packages/features/house` | [`house-building.md`](./house-building.md) | planned |

## Phases, roughly

| Phase | Content |
|---|---|
| 0 | Repository, docs, decisions — done ([spec 0001](../specs/0001-bootstrap-repository-structure.md)) |
| 1 | Tooling and the static build ([spec 0002](../specs/0002-monorepo-tooling-bootstrap.md)) |
| 2 | Geometry kernel decision ([spec 0003](../specs/0003-geometry-kernel-spike.md)) |
| 3 | Core modeler: document, geometry, viewport, basic tools, save/load — the SketchUp clone |
| 4 | Plugin host and the first domain feature |
| 5 | The remaining domains, in whatever order has a real user |

Everything after phase 3 is a plugin. If a domain needs something the core cannot express, the answer
is a contract change with a spec — never a domain concept inside `core`.

## What is not a feature

Built-in tools (select, line, rectangle, push/pull, move, rotate) are **not** plugins. They ship in
`packages/tools` as part of the modeler, because every user needs them and the plugin machinery would
only add indirection. A domain gets plugin status when it is optional.
