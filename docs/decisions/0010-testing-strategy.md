---
id: 0010
title: Testing strategy for a static, headless-core app
status: accepted
date: 2026-10-17
tags: [testing, quality, ci, geometry]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0010 — Testing strategy for a static, headless-core app

## Context

Most of this codebase's risk is not in the UI. It is in geometry (does extrude produce the right
solid?), commands (does undo actually restore the previous state?), persistence (does a round trip
preserve the document?), and the plugin contract (does a plugin failure stay contained?).

The architecture already makes those risks testable without a browser: `core` and `geometry` are
headless by invariant. What remains is deciding what gets tested where, so that agents write tests
that actually catch boundary violations rather than tests that merely exercise code.

The hostile case for testing is the renderer: WebGL output varies by GPU driver and headless
rendering is slow and flaky. A test strategy that depends on pixel comparisons of a 3D viewport will
be ignored within weeks.

## Decision

Layer the tests by what they can prove, and prefer the layers that are fast and deterministic.

| Layer | Tool | Covers | Speed |
|---|---|---|---|
| **Unit** | Vitest, Node, no DOM | geometry math, unit conversion, command inverse, store transactions, serialisation | milliseconds |
| **Contract** | Vitest + a golden plugin fixture | `plugin-api` behaviour: activation, capability refusal, manifest version check, dispose leaves a valid document | fast |
| **Document round-trip** | Vitest | build a document → save → load → deep-compare, including unknown plugin data preservation | fast |
| **Integration** | Vitest + jsdom (only where needed) | `tools` state machines driven by synthetic input events producing expected commands | fast |
| **End-to-end** | Playwright, Chromium | boot the built static bundle, draw something, undo, save, reload, restore | seconds |
| **Visual** | Playwright screenshots of the viewport, small and few | camera framing, grid, axis colours — not shading | slow, opt-in |

Rules:

- **Test the document, not the pixels.** Assertions target commands, entities, and geometry results.
- **Geometry tests are golden-file or property-based.** Golden files live next to the test; property
  tests assert invariants (a closed solid stays closed, a boolean preserves volume within tolerance).
- **Every command has an inverse test.** Apply, undo, compare to the pre-state. This is the single
  highest-value test type in the repository.
- **Boundary tests are explicit.** A test asserts that `core` and `geometry` have no DOM/`three`
  imports, so invariant violations fail CI instead of review.
- **Determinism is a test requirement** ([invariant 11](../architecture/invariants.md)). Tests never
  depend on wall-clock time, iteration order, or GPU state, and flaky tests are fixed or deleted, not
  retried.
- **Visual tests are opt-in** and pinned to a deterministic renderer configuration, and never gate a
  change to geometry logic on their own.
- **Tests live with the package they test** (`packages/x/src/**/*.test.ts`), except end-to-end tests
  in a top-level `e2e/`. A package's README names its test command.

## Consequences

**Good:** the expensive, flaky layer is the smallest one; most of the product's risk is covered by
millisecond tests running in Node; command-inverse tests catch the most common undo bug class before
review; explicit boundary tests turn architectural rules into failures rather than comments;
round-trip tests protect the file format, which is the hardest thing to change later.

**Bad:** golden geometry files are brittle across refactors and need deliberate regeneration, which
risks blessing a regression; property tests are harder to write than example tests and get skipped
under time pressure; the e2e layer needs a built bundle, so it is slow and agents run it last; jsdom is
a poor imitation of a browser and tempts over-testing of UI internals; with no coverage target,
"enough tests" stays a judgement call.

**Neutral:** vitest and Playwright follow from Vite ([0002](./0002-language-and-build-toolchain.md));
CI wiring is deferred to a tooling spec, so until then the definition of done depends on someone
running the suites locally.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Visual-heavy testing of the viewport | Flaky across GPUs, slow, and it tests the renderer rather than the model. |
| Jest or Cypress | Both work, but duplicate Vite's pipeline or are heavier than needed, with no benefit here. |
| Snapshot the whole document after every test | Large, unreadable diffs that nobody reviews; assertions should be about intent. |
| No unit tests, rely on manual checking | Fatal for a geometry kernel and an undo stack. |
| 100% coverage gate | Rewards testing getters; the risk is concentrated in a small number of hard paths. |

## Links

- How-to: [`../guides/testing.md`](../guides/testing.md)
- Related: [0002](./0002-language-and-build-toolchain.md), [0006](./0006-document-model-and-commands.md),
  [0007](./0007-local-first-persistence.md), [0011](./0011-geometry-kernel-strategy.md)
- Invariants: 7, 11 in [`../architecture/invariants.md`](../architecture/invariants.md)
