---
id: 0002
title: TypeScript, Vite, React, and a dependency-light store
status: accepted
date: 2026-10-17
tags: [language, tooling, ui, build]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0002 — TypeScript, Vite, React, and a dependency-light store

## Context

The language and framework choice has to serve three unusual requirements: the code is written
almost entirely by AI agents, the result must build to static files
([0001](./0001-static-hosting-github-pages.md)), and the core must be headless and testable without
a browser ([invariant 7](../architecture/invariants.md)).

Agents benefit disproportionately from types: a compiler that rejects a wrong call is context the
agent does not have to hold in its head, and it survives across sessions in a way that prose does
not.

## Decision

- **TypeScript, strict, everywhere.** `strict: true`, no implicit `any`, no `any` in package public
  entry points. Types are the primary machine-readable contract between packages.
- **ES modules only.** No CommonJS, no bundler-specific module syntax in source.
- **Vite** as the build tool and dev server, because its output is plain static files and it
  code-splits plugin chunks natively — which the plugin architecture depends on
  ([0005](./0005-plugin-architecture.md)).
- **React** for UI chrome only: menus, panels, inspectors, dialogs. The viewport is a WebGL canvas
  that React does not render into, so React's reconciliation never touches geometry.
- **A small in-house observable store in `core`**, wired to React through a thin adapter, instead of
  a large state library. The store is a few dozen lines over a plain subscriber list: explicit,
  testable in Node, and free of framework lifecycle semantics that would leak into `core`.
- **Minimal runtime dependencies.** Every runtime dependency added to `core`, `geometry`, or
  `scene` needs justification in an ADR. `ui` may take well-maintained React libraries when the cost
  of writing the component is higher than the cost of owning the dependency.

## Consequences

**Good:** the compiler catches boundary violations and refactors that prose review would miss;
Vite gives lazy-loadable static output for free; React's ecosystem covers the long tail of panels
and dialogs; a tiny store keeps `core` headless and free of framework lock-in; the same TypeScript
types serve source, tests, and docs.

**Bad:** the in-house store means writing an adapter and some subtle subscription code ourselves,
which a mature library would provide; React is a large dependency for what is mostly chrome; strict
TypeScript slows down exploratory geometry code, where loose math types are convenient; TypeScript's
type system cannot express dimensional analysis, so unit confusion is caught only by convention and
tests ([0008](./0008-units-coordinates-precision.md)).

**Neutral:** the store's shape is an interface we control, so replacing it later is contained to
`core` and `ui`; React may be replaced in the chrome without touching the viewport.

## Alternatives considered

| Alternative | Why not |
|---|---|
| JavaScript with JSDoc types | Weaker inference and no compile-time enforcement at package boundaries. |
| Svelte / Vue | Smaller chrome, but thinner ecosystems for the dense UI a CAD tool needs, and equally unproven for agent-authored density. |
| Redux / Zustand / XState for state | Real value, but the first three are unnecessary for a single document store, and XState's complexity belongs inside individual tools, not the document. |
| Immutable state library (Immer, Immutable.js) for the document | Useful, but the command system ([0006](./0006-document-model-and-commands.md)) already gives us structural sharing points; adopt later if profiling demands it. |
| Web Components for the UI | Isolation is nice, but data flow into panels is more awkward than React's, and agent familiarity is lower. |
| Webpack / esbuild directly | Vite's static output plus code-splitting fits the plugin story with less configuration. |

## Links

- Related: [0001](./0001-static-hosting-github-pages.md), [0005](./0005-plugin-architecture.md),
  [0006](./0006-document-model-and-commands.md)
