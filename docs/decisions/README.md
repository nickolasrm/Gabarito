# Decision records

Append-only records of *why* Gabarito is the way it is. One decision per file, small enough to
read on its own.

## How to use this folder

1. Read the index below first. It is the only file here you should read by default.
2. Open only the records that match your task — usually one to three.
3. To search the full text instead: `rg -i '<keyword>' docs/decisions`
4. If your change contradicts an accepted record, you do **not** edit it. You write a new record
   that supersedes it and mark the old one in the index.

The rule that makes this folder useful over time: **accepted records are immutable.** Old reasoning
stays searchable forever.

## Index

| ID | Title | Status | Tags | Supersedes |
|---|---|---|---|---|
| [0001](./0001-static-hosting-github-pages.md) | Static hosting on GitHub Pages, no server | accepted | hosting, deployment, constraints | — |
| [0002](./0002-language-and-build-toolchain.md) | TypeScript, Vite, React, and a dependency-light store | accepted | language, tooling, ui | — |
| [0003](./0003-rendering-engine-threejs.md) | Three.js as the rendering layer | accepted | rendering, webgl, three | — |
| [0004](./0004-repository-layout.md) | Repository layout and module boundaries | accepted | structure, monorepo, boundaries | — |
| [0005](./0005-plugin-architecture.md) | Plugins as the extension mechanism | accepted | plugins, extensibility, contracts | — |
| [0006](./0006-document-model-and-commands.md) | Document model with commands as the only mutation path | accepted | core, state, undo | — |
| [0007](./0007-local-first-persistence.md) | Local-first persistence with no backend | accepted | persistence, storage, offline | — |
| [0008](./0008-units-coordinates-precision.md) | Millimetres, radians, Z-up, and precision rules | accepted | units, geometry, conventions | — |
| [0009](./0009-documentation-workflow.md) | Specs and ADRs as the documentation workflow | accepted | process, docs, agents | — |
| [0010](./0010-testing-strategy.md) | Testing strategy for a static, headless-core app | accepted | testing, quality, ci | — |
| [0011](./0011-geometry-kernel-strategy.md) | Geometry kernel: adopt first, build later | **proposed** | geometry, csg, kernel | — |

Statuses: `proposed` → `accepted` → (`superseded` | `deprecated` | `rejected`).

## Template

Copy [`0000-template.md`](./0000-template.md). Numbering is sequential and never reused, even if a
record is rejected. How-to: [`../guides/writing-an-adr.md`](../guides/writing-an-adr.md).

## Numbering note

Record numbers are permanent identifiers, not an ordering of importance. Specs reference them by
number (`decision 0005`), so a superseded record keeps its link forever.
