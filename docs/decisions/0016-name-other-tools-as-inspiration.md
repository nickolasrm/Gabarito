---
id: 0016
title: Name other tools as inspiration, never as a target
status: accepted
date: 2026-10-17
tags: [docs, positioning, legal, public]
supersedes: []
superseded_by: null
specs: [0011]
---

# 0016 — Name other tools as inspiration, never as a target

## Context

Gabarito's interaction model — draw faces, pull them into solids, snap and infer — comes from an
existing family of face-based modelers, and this repository has named the best-known one since the
first commit. Naming it is useful: it explains the product in four words, and it tells a reader which
conventions to expect.

The repository is now public ([spec 0011](../specs/0011-repository-goes-public.md)), so those words are read by
other people, including the users and the owner of the tool being named.

Two framings are possible and they are not equivalent. *Inspired by* is attribution: it says the
interaction model is good and we learned from it. *Clone of* or *free alternative to* is a claim on
someone else's product: it invites a trademark complaint, it makes the project sound derivative rather
than useful, and it is a promise this project cannot keep — nothing here is file-compatible, and a
woodworker who expects the original will be disappointed.

## Decision

Name other tools as **inspiration** or for **honest comparison**, and never as a target.

- Never write "clone of X", "free alternative to X", "X without the licence fee", "replaces X", or any
  equivalent claim about another product.
- Never imply affiliation, endorsement, or continuation. State independence when a tool is named as
  the reason a design exists.
- Naming a tool for comparison stays allowed, including when the comparison is unflattering to us.
  Honest comparison is what makes the docs useful.
- This applies to every tracked artefact: docs, code comments, commit messages, PR and issue text, and
  the repository description.
- What is forbidden is a *claim about the other product*, not the mention of it. Referencing is
  encouraged; competing is not.

## Consequences

**Good:** the docs stay honest about where the design comes from; the project reads as an independent
tool with its own reasons rather than as a knock-off; there is no trademark or unfair-competition
argument to answer; users arrive with the right expectation — a similar interaction model, not a
compatible replacement.

**Bad:** a genuinely useful marketing sentence is off the table. "The free alternative to X" is what
search engines and comparisons reward, and dropping it costs discoverability. It also removes a
legitimate framing for a project that really is a lighter option for some users, so the docs have to
work harder to say what the tool is for.

**Neutral:** the rule is about framing, so it is a judgement call at the edges, which is why it lives
in `AGENTS.md` as a rule with examples rather than as a keyword ban. A keyword ban would also be wrong
here: the words are allowed, the claim is not.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Stop naming other tools entirely | Loses the fastest explanation of the product and the honest attribution, and makes the docs vaguer, not safer. |
| Name tools freely and add a disclaimer | A disclaimer does not undo a claim; "not affiliated, but it replaces X" still leads with the claim. |
| Ban the words with a CI keyword check | Wrong tool: it would block honest comparison and pass a rephrased claim. The claim is the problem, not the string. |
| Keep it as a documented convention only, no ADR | A public repository's tone is a decision future agents will be tempted to ignore for one catchy sentence. The reason has to be written down. |

## Links

- Spec: [0011](../specs/0011-repository-goes-public.md)
- Related: [0001](./0001-static-hosting-github-pages.md) (why the repository is public),
  [0017](./0017-pull-requests-only.md)
