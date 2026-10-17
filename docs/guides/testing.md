# Testing

The strategy and its justification are in
[decision 0010](../decisions/0010-testing-strategy.md). This page is the practical half.

## Which layer do I use?

| You changed | Test layer |
|---|---|
| Math in `geometry`, unit conversion, serialisation | Unit test in the package, Node, no DOM |
| A command or store transaction | Unit test + the **inverse test** (below) |
| The `plugin-api` contract or `plugin-host` | Contract test with the golden plugin fixture |
| The project file format | Round-trip test: build → save → load → deep compare |
| A tool's state machine | Integration test with synthetic input events, asserting emitted commands |
| React chrome | Component test only where logic exists; otherwise rely on the e2e smoke test |
| Rendering, camera framing | Opt-in visual test, or assert on camera/scene state instead |

When in doubt, push the test down a layer. A Node test that proves the geometry is worth more than a
browser test that proves a pixel.

## The inverse test

The highest-value test in this repository. Every command must pass it:

```ts
const before = store.snapshotForTest();
const command = makeCommand(...);
store.apply(command);
store.apply(inverseOf(command));
expect(store.snapshotForTest()).toEqual(before);
```

If a command has no inverse, it must not be a command.

## Rules

- **Determinism.** No `Date.now()`, no `Math.random()` without a seeded source, no reliance on
  iteration order. A flaky test is either fixed or deleted — never retried into passing.
- **Assert intent, not implementation.** "The solid is closed and has the expected volume within
  tolerance" beats "the vertex array equals this 400-line literal".
- **Golden files are deliberate.** They live next to the test. Regenerating one is a reviewed action,
  not a reflex; a golden diff is a signal that behaviour changed.
- **Tolerances are named.** Compare with the epsilon constants from `geometry`, not with `===` or an
  inline magic number.
- **No network, no clock, no GPU** in unit tests.
- **One behaviour per test name.** The name should read as a claim that is either true or false.

## Where tests live

```
packages/<name>/src/**/*.test.ts     unit, integration, contract — colocated with the code
e2e/**                               Playwright, against the built static bundle
```

A package's `README.md` states its own test command. From the root, everything runs together.

## Boundary tests

These enforce the architecture and must exist:

- `core` and `geometry` import no DOM globals and no `three` ([invariant 7](../architecture/invariants.md)).
- Feature packages import only `plugin-api` ([module boundaries](../architecture/module-boundaries.md)).
- A plugin can be activated and disposed without leaving the document invalid
  ([invariant 10](../architecture/invariants.md)).

If you find a boundary rule with no test, adding one is always in scope.

## Checklist

- [ ] The change is covered at the lowest sensible layer
- [ ] New commands have inverse tests
- [ ] Deterministic; no clock, network, or GPU dependence
- [ ] Comparisons use named tolerances
- [ ] Boundary tests still pass
- [ ] Any new boundary rule has a test enforcing it
