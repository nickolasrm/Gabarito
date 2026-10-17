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
| [0011](./0011-geometry-kernel-strategy.md) | Geometry kernel deferred: extrusion only for now | **superseded** by 0019 | geometry, csg, kernel | — |
| [0012](./0012-tool-input-model.md) | Typed values and axis locking belong to the input layer | accepted | tools, input, ux | — |
| [0013](./0013-curves-are-tessellated.md) | Curves are tessellated into straight edges | accepted | geometry, curves | — |
| [0014](./0014-guides-and-dimensions-as-entities.md) | Guides and dimensions are first-class, non-geometric entities | accepted | core, annotations | — |
| [0015](./0015-core-depends-on-geometry.md) | core may depend on geometry | accepted | structure, boundaries | 0004 |
| [0016](./0016-name-other-tools-as-inspiration.md) | Name other tools as inspiration, never as a target | accepted | docs, positioning, legal | — |
| [0017](./0017-pull-requests-only.md) | Every change lands through a pull request | accepted | process, git, review | — |
| [0018](./0018-axis-lock-semantics.md) | What an axis lock means, and the plane it needs | accepted | tools, input, geometry | — |
| [0019](./0019-mesh-csg-kernel.md) | Adopt a mesh CSG library for solid cuts | accepted | geometry, csg, kernel | 0011 |
| [0020](./0020-drawing-plane-inference.md) | The drawing plane is chosen by what the pointer aims at | accepted | tools, geometry, ux | — |

Statuses: `proposed` → `accepted` → (`superseded` | `deprecated` | `rejected`).

## Template

Copy [`0000-template.md`](./0000-template.md). Numbering is sequential and never reused, even if a
record is rejected. How-to: [`../guides/writing-an-adr.md`](../guides/writing-an-adr.md).

## Numbering note

Record numbers are permanent identifiers, not an ordering of importance. Specs reference them by
number (`decision 0005`), so a superseded record keeps its link forever.
