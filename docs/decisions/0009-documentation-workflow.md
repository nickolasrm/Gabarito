---
id: 0009
title: Specs and ADRs as the documentation workflow
status: accepted
date: 2026-10-17
tags: [process, docs, agents, context]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0009 — Specs and ADRs as the documentation workflow

## Context

This repository is written by AI agents under human direction, which creates two problems ordinary
project documentation does not solve.

**Sessions do not share memory.** An agent starting tomorrow has only the repository, so anything
decided but unwritten gets decided again, possibly differently.

**Context is a budget.** Every file an agent reads competes with the code, the tests, and the task. One
2,000-line `ARCHITECTURE.md` guarantees that most of what is read is irrelevant, and that agents skim —
which means boundaries get violated by well-meaning agents, not careless ones.

The naive fix, documenting everything meticulously in one place, fails. The fix has to be
*progressive*: a small stable entry point, a router, and many small files found by search.

## Decision

Two kinds of documents, with different lifecycles, plus strict layering.

**Specs** (`docs/specs/`) describe **changes**. One file per change, numbered, ~1–2 pages, with status
`proposed → accepted → implemented`. Written *before* the work, updated *after* it with a `## Result`
section. Nothing lands without one.

**ADRs** (`docs/decisions/`) describe **decisions**. One file per decision, numbered, and
**append-only**: once accepted, never edited. Changing your mind means a new record that supersedes the
old one, so "why is it like this?" stays answerable — the question agents ask most and can least afford
to get wrong.

**Progressive layering.** `AGENTS.md` is always read (~1 page). `docs/README.md` is the only index and
routes every task to the right layer. `docs/architecture/` holds the current shape, one concept per
file. Decision records are read 1–3 at a time, never all. The spec being executed, the relevant guide,
the relevant feature file, and the relevant package `README.md` are the only other files a task needs.
The full map is in [`docs/README.md`](../README.md).

**Searchability by construction.** Every ADR and spec carries YAML front matter (`id`, `title`,
`status`, `date`, `tags`, `supersedes`, `specs`), and tags are the retrieval key —
`rg '^tags:.*rendering' docs/decisions`.

**Indexes are mandatory.** `docs/decisions/README.md` and `docs/specs/README.md` hold one line per
file with status and tags. That is what makes "read 1–3 records" possible. A file missing from its
index is a bug, fixed in the same commit.

**Size budgets, and a changelog.** Architecture and decision files stay under ~90 lines, specs under
~150; exceeding the budget means splitting the file, not raising it. `CHANGELOG.md` records what
changed and links each entry to its spec.

## Consequences

**Good:** an agent starts a task after ~2 pages and adds detail on demand; months-old reasoning survives
and is findable by tag or full text; the spec is the unit of scope, so "stay inside the spec" is
enforceable rather than aspirational; review has a checklist (spec closed, changelog updated, index
updated, boundaries respected); abandoned directions stay documented instead of being re-proposed;
superseding rather than editing makes the docs an audit trail, not a snapshot.

**Bad:** real overhead per change — a spec before, a `Result` after, a changelog line, sometimes an ADR;
small changes feel over-documented, and the PR template deliberately makes that unavoidable; the tree
accumulates many small files, so navigation depends on indexes staying accurate; front matter is a
formatting burden a generated index would eventually remove; nothing prevents a wrong spec, only an
invisible one. A docs-lint check (front matter, index integrity, size budgets) would make the discipline
mechanical instead of editorial — future work, since there is no tooling yet.

## Alternatives considered

| Alternative | Why not |
|---|---|
| One large `ARCHITECTURE.md` | Bloats context, gets skimmed, and cannot hold superseded reasoning alongside current reasoning. |
| Decisions only in commit messages | Not greppable by structure, buried in history, impossible to index by status. |
| Decisions only in the issue tracker | Leaves the repository incomplete on its own; a reader of the repo cannot see them. |
| Living docs edited in place, or one big append log | The first loses the audit trail; the second grows without bound, so every read costs more over time. |
| Let agents choose how to document | Guarantees drift, which is the failure mode this record exists to prevent. |

## Links

- Rules an agent follows: [`../../AGENTS.md`](../../AGENTS.md), [`docs/README.md`](../README.md)
- How-tos: [`../guides/writing-a-spec.md`](../guides/writing-a-spec.md),
  [`../guides/writing-an-adr.md`](../guides/writing-an-adr.md)
- Related: [0004](./0004-repository-layout.md), [0005](./0005-plugin-architecture.md)
