# Module boundaries

Boundaries are enforced by directory, not by discipline. Before adding an import, check this file.
See it is violated in review, say so.

## Allowed dependency directions

Arrows mean "may import". Anything not listed is forbidden.

```
apps/web ──► packages/app ──► packages/{ui,tools,scene,persistence,plugin-host}
                                  │        │      │       │
                                  │        │      │       └──► core, geometry
                                  │        │      └──────────► core, geometry
                                  │        └─────────────────► core, geometry
                                  └──────────────────────────► core, plugin-api
packages/core ──► packages/geometry
packages/{geometry,plugin-api} ──► (nothing in this repo)
packages/features/* ──► packages/plugin-api
```

Layers: **leaves** (`geometry`, `plugin-api`) import nothing. **Foundations** (`core`) import only
leaves. Everything else imports its own layer and below.

## Rules

| Rule | Rationale |
|---|---|
| `geometry` imports **no** other package. | It owns the numerical guarantees and must be testable in isolation, with no state. |
| `core` imports only `geometry`. | Recorded in [decision 0015](../decisions/0015-core-depends-on-geometry.md); the earlier "imports nothing" rule was wrong. |
| `plugin-api` imports no other package. | It is the contract; contracts cannot depend on implementations. |
| Nothing outside `apps/web` knows the app is on GitHub Pages. | Base paths and hosting quirks stay at the edge. |
| `ui` never imports `scene` or Three.js. | React chrome and WebGL viewport are separate worlds; they meet through `core` state and events. |
| `tools` never imports Three.js. | Tools reason about the document and `geometry`, not about render objects. |
| `core` never imports React, Three.js, or any browser global. | Invariant 7. |
| Feature packages import **only** `plugin-api`. | They extend through the contract. If a feature needs more, extend the contract — with a spec. |
| Features never import each other. | Woodworking must not depend on lighting. Compose through the host. |
| Cross-package imports go through the package's public entry point. | No reaching into `packages/x/src/internal/...`. |

## Import form

```ts
import { createDocument } from "@gabarito/core";        // correct
import { createDocument } from "../../core/src/doc";    // wrong
```

Deep imports into another package are a boundary violation even when they technically resolve.
Each package exposes one public entry point; everything else is internal.

## When a rule gets in the way

That is a signal, not an obstacle. Write a spec that proposes the boundary change and an ADR that
records the new rule. Do not add the import first and argue afterwards.

Related: [invariants](./invariants.md) 8–11, [decision 0004](../decisions/0004-repository-layout.md).
