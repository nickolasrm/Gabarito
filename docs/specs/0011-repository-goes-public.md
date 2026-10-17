---
id: 0011
title: Repository goes public, with two new rules
status: implemented
date: 2026-10-17
packages: [docs, web]
decisions: [0016, 0017]
supersedes: null
---

# 0011 — Repository goes public, with two new rules

## Goal

Make Gabarito public, publish the built app to GitHub Pages on every push to `main`, and add the two
rules that going public makes necessary: how this project talks about other tools, and how changes
land.

## Why now

The static-hosting requirement has been [decision 0001](../decisions/0001-static-hosting-github-pages.md)
since the first record, and it could not actually be met: Pages on a **private** repository needs a
paid plan, so the deploy workflow was manual and every push showed a failing job. Making the
repository public removes that limitation and publishes the app in the same step.

Public changes two things that were previously only good manners:

- Text about other tools is now read by those tools' users. The project names its inspirations and
  must not read as a free replacement for them.
- `main` is now a public interface. An unreviewed commit to it is no longer a private mistake.

## Scope

**In scope**

- Repository visibility: private → public.
- Pages enabled, and `deploy-pages.yml` publishing on every push to `main` instead of on demand only.
- Rule: name other tools as inspiration, never as a replacement, clone or competitor
  ([decision 0016](../decisions/0016-name-other-tools-as-inspiration.md)).
- Rule: every change lands through a pull request
  ([decision 0017](../decisions/0017-pull-requests-only.md)), enforced by branch protection on `main`.
- Rewording the places that framed the project as a copy of its main inspiration.

**Out of scope**

- Removing the references themselves. They stay: naming an inspiration is honest attribution, and the
  new rule is about framing, not about silence.
- A licence file. The repository is public with no licence, which by default means all rights
  reserved — not what "open source" means. Choosing one is an owner decision, deliberately not made
  by an agent. Flagged, not guessed.
- Rewriting the one commit subject that still says the project is a copy of its reference. That needs
  a force-push of `main`, which is an owner decision under the new rule.

## Plan

1. Set repository visibility to public.
2. Enable Pages with the workflow build type and publish.
3. Verify the published app loads and behaves, not just that HTML is served.
4. Add both rules to `AGENTS.md`, plus the definition-of-done items and the PR-template checkboxes.
5. Reword the copy framing in the feature doc and in spec 0007.
6. Restore the on-push trigger in `deploy-pages.yml`.
7. Land all of it through a pull request, then protect `main`.

## Design notes

The rules live in `AGENTS.md` because that is what every agent reads; the reasoning lives in the two
ADRs, so a future agent can argue with the reason instead of the sentence.

The pull-request rule is enforced **mechanically** by branch protection rather than by convention,
because conventions lose. Protection deliberately requires no approvals: GitHub does not let an author
approve their own PR, so requiring one would deadlock a repository where the reviewer and the author
are the same agent.

## Risks

| Risk | Mitigation |
|---|---|
| Published history still contains "clone" wording in one commit subject | Documented here; rewording it needs a force-push, so it waits for an explicit owner decision. |
| Branch protection that requires approvals deadlocks an agent-only repo | Zero approvals required; `main` is protected against direct pushes instead. |
| Public repository with no licence | Flagged as the next owner decision. It is not an agent's call. |
| Auto-deploy publishes a broken build | The deploy job runs the full check suite and builds before it publishes, and only on success. |

## Verification

- [x] Repository visibility is public
- [x] Pages serves the app: HTML 200, the JS asset 200, `.nojekyll` 200
- [x] The published bundle hash is the same artifact the end-to-end suite passed against
- [x] `AGENTS.md` carries both rules; the PR template carries both checkboxes
- [x] No copy or replacement framing remains outside the rule text itself
- [x] `main` is protected and this change landed through a pull request

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** the repository is public; Pages publishes at
  <https://nickolasrm.github.io/Gabarito/> and now runs on every push to `main`; `AGENTS.md` gained
  "Pull requests only" and "Talking about other products"; `docs/decisions/0016` and `0017`; the PR
  template gained both checks; and the copy framing in `docs/features/sketchup-core.md` and spec 0007
  is now "inspired by".
- **Deviations from the plan:** the order was public → Pages → rules, rather than Rules first. The
  rules change is the first pull request, which is what demonstrates the flow it introduces.
- **Follow-up specs:** add a licence; reword the remaining commit subject if the owner wants it.
