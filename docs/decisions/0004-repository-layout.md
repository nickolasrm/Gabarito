---
id: 0004
title: Repository layout and module boundaries
status: accepted
date: 2026-10-17
tags: [structure, monorepo, boundaries, process]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0004 — Repository layout and module boundaries

## Context

The product will start as a SketchUp-like modeler and later grow domain modules for woodworking,
lighting design, and house building. The failure mode to avoid is the classic one: the domain
concepts leak into the core, and by the time the third domain arrives the core is a pile of `if
(woodworking)` branches.

Agents make this failure mode *more* likely, not less: an agent asked to add a feature takes the
shortest path to a passing test, and the shortest path usually crosses a boundary.

So boundaries must be structural, not aspirational — enforced by where files live, checked by
import rules, and enforced again in review.

## Decision

A small monorepo with one deployable app and a set of libraries, each with a single public entry
point:

```
apps/web                   the static site: Vite entry, routing, Pages config, no domain logic
packages/core              document, entities, selection, commands, undo, units, events
packages/geometry          pure math and solid operations
packages/scene             Three.js viewport; the only importer of `three`
packages/tools             interaction state machines (built-in, not plugins)
packages/ui                React chrome
packages/persistence       local storage and project file I/O
packages/plugin-api        the contracts plugins implement; the only cross-cutting interface
packages/plugin-host       manifest, registration, activation lifecycle
packages/app               composition root; the only package that wires everything together
packages/features/<name>   first-party domain plugins
docs/                      specs, decisions, architecture, guides, features
```

Rules:

- **One entry point per package.** Everything else is internal. Deep imports across packages are
  violations even when they resolve.
- **`core`, `geometry`, and `plugin-api` depend on nothing in this repository.**
- **Domain concepts live only in `packages/features/*`**, behind `plugin-api`.
- **Hosting quirks live only in `apps/web`.** Base paths, `404.html` fallback, and Pages specifics
  never appear deeper in the tree.
- The full allowed-import matrix is [`../architecture/module-boundaries.md`](../architecture/module-boundaries.md)
  and is the normative reference; this record explains why it exists.

## Consequences

**Good:** a feature can be added, tested, and deleted without touching the core; the same structure
works for third-party plugins later; a package's README is a complete context for working in it,
which keeps agent context small; boundaries are visible in a directory listing, so an agent can see
where code belongs before writing it.

**Bad:** more ceremony than a single `src/` folder — new concepts need a home and a README; some
cross-cutting utilities will be duplicated rather than shared through a `utils` package, on purpose,
because a shared `utils` package becomes a boundary leak by another name; intra-repo packages add
build configuration complexity once tooling lands.

**Neutral:** strict boundaries make some refactors feel slower early and much faster later; if a
shared abstraction is genuinely needed, it is promoted deliberately with a spec instead of by
accident.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Single package with folders | Nothing stops a feature from importing core internals; the boundary is only a convention, and conventions lose. |
| Separate repositories per module | Clean isolation, but versioning, atomic commits across the core, and agent context all get worse. |
| A `packages/utils` or `packages/shared` package | Becomes the single place every layer may depend on, which reintroduces coupling. Duplicate small helpers instead. |
| Layering by feature (`features/core`, `features/rendering`) rather than by concern | Obscures the headless-core boundary, which is the one that must not be crossed. |

## Links

- Related: [0002](./0002-language-and-build-toolchain.md), [0005](./0005-plugin-architecture.md),
  [0006](./0006-document-model-and-commands.md)
- Normative detail: [`../architecture/module-boundaries.md`](../architecture/module-boundaries.md)
