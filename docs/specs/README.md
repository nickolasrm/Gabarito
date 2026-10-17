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
| [0002](./0002-monorepo-tooling-bootstrap.md) | Bring up monorepo tooling and the static build | proposed | web, all | 0001, 0002, 0004 |
| [0003](./0003-geometry-kernel-spike.md) | Spike the geometry kernel candidates | proposed | geometry | 0011 |

## Writing one

Copy [`TEMPLATE.md`](./TEMPLATE.md); step-by-step instructions are in
[`../guides/writing-a-spec.md`](../guides/writing-a-spec.md). Keep it under ~150 lines, one change
per spec, and link the decisions it depends on.

## Reading one

Specs are historical documents. A `implemented` spec describes a change that already happened; read
the `## Result` section to learn what actually shipped, including deviations from the plan.

To find open work: `rg '^status: (proposed|accepted)' docs/specs`
