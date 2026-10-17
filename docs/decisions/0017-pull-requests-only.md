---
id: 0017
title: Every change lands through a pull request
status: accepted
date: 2026-10-17
tags: [process, git, review, public]
supersedes: []
superseded_by: null
specs: [0011]
---

# 0017 — Every change lands through a pull request

## Context

Every commit in this repository is written by an AI agent, under human direction, and `main` is the
branch that deploys to GitHub Pages. Until now the agent committed straight to `main`, because there
was nobody else to review and the repository was private.

That has three costs. The build that ships is whatever the last agent pushed, with no point in the
history where a change was seen as a change rather than as the current state. The spec and the code
travel together in the same commit, so the plan is never reviewed separately from the result. And a
mistake is only visible after it is already on `main`.

The repository is now public ([spec 0011](../specs/0011-repository-goes-public.md)), which makes the
history a public interface rather than a scratchpad.

## Decision

**Every change lands through a pull request. `main` is protected and never receives a direct push.**

- Branch as `<type>/<slug>`; open the PR with `gh pr create`; the body links the spec.
- Merge with a squash merge and delete the branch, so `main` stays a linear list of finished changes.
- The PR is where checks run and where the spec is reviewed against the result.
- **No required approvals**, deliberately. GitHub does not allow self-approval, so requiring one would
  deadlock a repository where the author and the reviewer are the same agent. The PR is a review
  *point*, and it is honest to say so rather than to fake a second reviewer.
- Never force-push `main`. Rewriting published history is a one-off owner decision, asked for
  explicitly, and it is not something an agent does as part of a change.
- Branch protection enforces the rule mechanically, because a rule that depends on remembering is not
  a rule.

## Consequences

**Good:** every change has a title, a description and a diff that a human can read later, and the
spec is visible next to the code it produced; CI runs before `main` moves, so a broken build cannot
reach the published app; the squash merge keeps `main` readable, one entry per change; a mistake is
caught at the PR, where it is cheap, rather than on the live site.

**Bad:** real friction on tiny changes — a one-line commit now costs a branch, a push, a PR and a
merge; the review is thin by construction, since the author merges their own work, so this buys
traceability and a CI gate rather than independent judgement — calling it "review" oversells it; the
PR body is one more artefact that can go stale; and if the agent's token loses permission to open PRs,
all work stops, where direct commits would have kept going.

**Neutral:** squash merging discards the intra-branch commit structure. That is a real loss for a long
investigation, and the answer is a longer PR description rather than a merge commit. Whether `main`
should also require green status checks is left open; it would strengthen the gate and add a way for
main to get stuck.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep committing to `main`, rely on CI | CI catches a broken build after it is already on the deploying branch, and there is no reviewed unit of change to point at later. |
| Require one approval, as GitHub intends | Deadlocks: the author cannot approve their own PR, and there is no second person. |
| GitFlow with a long-lived `develop` branch | Two integration branches is more process than a project with one contributor and continuous deployment needs. |
| Trunk-based with feature flags | The right answer for a large team shipping continuously behind flags; there are no flags here and no team. |
| No branch protection, convention only | The previous state. It held until it did not, and an agent under time pressure is exactly the actor that skips a convention. |

## Links

- Spec: [0011](../specs/0011-repository-goes-public.md)
- Related: [0016](./0016-name-other-tools-as-inspiration.md), [0009](./0009-documentation-workflow.md)
