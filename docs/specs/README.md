# Specs

One small plan per change. A spec is written **before** the work and closed **after** it. No change
to this repository lands without one — see [`../../AGENTS.md`](../../AGENTS.md).

## Lifecycle

| Status | Meaning |
|---|---|
| `proposed` | Written, not approved. Not safe to implement. |
| `accepted` | Approved. Implement exactly this, no more. |
| `implemented` | Done, with a `## Result` section describing what actually shipped. |
| `rejected` | Not doing it. Kept for the reasoning. |
| `superseded` | Replaced by a later spec, which is linked. |

Spec numbers are permanent and never reused. They are referenced by commits (`Spec: docs/specs/…`)
and by decision records, so a rejected spec keeps its number forever.

## Index

| ID | Title | Status | Packages | Decisions |
|---|---|---|---|---|
| [0001](./0001-bootstrap-repository-structure.md) | Bootstrap the repository structure | implemented | docs, all | 0001–0010 |
| [0002](./0002-monorepo-tooling-bootstrap.md) | Bring up monorepo tooling and the static build | implemented | web, all | 0001, 0002, 0004 |
| [0004](./0004-core-document-geometry-viewport.md) | Core document, geometry, and viewport slice | implemented | core, geometry, scene, app, web | 0003, 0006, 0008, 0011, 0013 |
| [0005](./0005-units-and-measurement.md) | Units and measurement | implemented | core, tools, ui | 0008, 0012 |
| [0006](./0006-snapping-inference-axis-locks.md) | Snapping, inference, and axis locks | implemented | tools, scene | 0012 |
| [0007](./0007-drawing-and-transform-tools.md) | Drawing and transform tools with typed input | implemented | tools, scene, ui, app | 0006, 0012, 0014 |
| [0008](./0008-camera-navigation.md) | Camera navigation | implemented | scene | 0003, 0008 |
| [0010](./0010-force-style-skills-on.md) | Force the caveman and ponytail style skills on | implemented | docs | — |
| [0011](./0011-repository-goes-public.md) | Repository goes public, with two new rules | implemented | docs, web | 0016, 0017 |
| [0012](./0012-tool-interaction-fixes.md) | Fix six tool interaction bugs | implemented | tools, scene, core, app | 0018 |

Numbers are permanent and are never reused, so the gaps left by pruned specs stay gaps.

## Writing one

Copy [`TEMPLATE.md`](./TEMPLATE.md); step-by-step instructions are in
[`../guides/writing-a-spec.md`](../guides/writing-a-spec.md). Keep it under ~150 lines, one change
per spec, and link the decisions it depends on.

## Reading one

Specs are historical documents. A `implemented` spec describes a change that already happened; read
the `## Result` section to learn what actually shipped, including deviations from the plan.

To find open work: `rg '^status: (proposed|accepted)' docs/specs`
