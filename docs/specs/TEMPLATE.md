---
id: 0000
title: <imperative, e.g. "Implement viewport picking">
status: proposed          # proposed | accepted | implemented | rejected | superseded
date: YYYY-MM-DD
packages: [core, scene]   # packages this change touches
decisions: [0006]         # decision records it relies on or adds
supersedes: null          # spec id this replaces, if any
---

# 0000 — <title>

<!--
Under ~150 lines. One change per spec. Written before the work; closed after it.
If you find yourself describing several changes, split the spec.
-->

## Goal

One or two sentences. What is true after this that is not true now? No implementation detail.

## Why now

What forces this change — a decision, a blocked feature, a bug, a user need. Link the decision
records involved.

## Scope

**In scope**

- Concrete, checkable outcomes.

**Out of scope**

- Things a reader would reasonably expect but that this spec deliberately does not do. This is the
  most important section for agents: it is what stops scope creep.

## Plan

1. Ordered steps, small enough to review.
2. Name the files and interfaces that will change.
3. Note the public interface additions, since they must be documented in the package `README.md`.

## Design notes

Only what the plan cannot express: shapes, trade-offs, rejected approaches *inside* this change.
If a note becomes a long-lived rule, it belongs in an ADR instead.

## Risks

| Risk | Mitigation |
|---|---|
| What could go wrong | How we would notice or prevent it |

## Verification

- [ ] Specific commands to run
- [ ] Unit / contract / e2e tests to add, per [`../guides/testing.md`](../guides/testing.md)
- [ ] Manual checks, and what to look at

## Docs to update

- [ ] `CHANGELOG.md` entry
- [ ] `docs/specs/README.md` index row
- [ ] `docs/decisions/README.md` if an ADR is added
- [ ] Package `README.md` files for changed public interfaces
- [ ] `docs/architecture/` if the system's shape changed

## Result

> Filled in when the spec is closed. Delete this section while the spec is `proposed` or `accepted`.

- **Status:** implemented on YYYY-MM-DD
- **What shipped:** …
- **Deviations from the plan:** … (or "none")
- **Follow-up specs:** …
