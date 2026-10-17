---
id: 0013
title: The owner verifies the running app before a merge
status: implemented
date: 2026-10-17
packages: [docs]
decisions: []
supersedes: null
---

# 0013 — The owner verifies the running app before a merge

## Goal

Make local, hands-on verification the gate before a merge, instead of tests alone.

## Why now

Requested directly, and the last change proves the point. Six interaction bugs shipped through a green
pipeline: [spec 0012](./0012-tool-interaction-fixes.md) fixed a frozen axis lock, a dead push/pull drag,
a rectangle that could not be drawn vertically, a triangle that would not close, a missing cursor, and a
move tool with no preview. Every one of them was visible in about ten seconds of clicking, and every one
of them passed the tests that existed at the time.

The pipeline answers "is the code what I think it is". It cannot answer "does it feel right". Only the
owner can, and only by using it.

## Scope

**In scope**

- A rule in `AGENTS.md`: keep the app running on <http://127.0.0.1:5173> for the whole session, tell the
  owner what to click, and **ask before merging**.
- A checkbox in the pull request template for the owner's verification.
- Reserving port `5199` for the Playwright suite.

**Out of scope**

- Automating the check as a browser test. A test asserts what someone thought to assert, which is exactly
  what failed to catch the last six bugs.
- Changing what CI runs, and adding required status checks to `main`.
- Any change to the code under test.

## Plan

1. Add the "Verify before merging" section to `AGENTS.md`, and change the merge step of "Pull requests
   only" to require an explicit yes.
2. Add the verification checkbox to the pull request template.
3. Start the dev server on `5173` and leave it running.
4. Land this through a pull request, and ask before merging it — the rule applies to its own change.

## Design notes

**Why the port matters.** The rule says "always running", which collides with the browser suite:
`playwright.config.ts` uses `5199` with `reuseExistingServer: false`, so a server already on that port
makes every end-to-end run fail to start. The agent then kills the port and the "always running"
promise is quietly broken. Splitting the ports — `5173` for the owner, `5199` for Playwright — is what
makes the rule survivable rather than aspirational.

**Why "ask" is a separate rule from "verify".** Verification is something the owner can do; merging is
something the agent does. Between them there is a decision, and the agent does not get to make it
because the tests are green. Writing only "verify first" would leave the agent free to merge as soon as
it judged the verification adequate.

## Risks

| Risk | Mitigation |
|---|---|
| A forgotten dev server breaks the browser suite | Ports are separated on purpose (`5173` vs `5199`), and stated in the rule. |
| Verification becomes a ritual "yes" | The rule requires saying what to click and what should happen, so the check is specific. |
| The rule stalls work when the owner is away | That is the intent. Unverified user-visible work waits; it does not merge on the agent's judgement. |
| The rule is read as "never merge without asking, even for docs" | Deliberate. Asking costs a message; an unverified merge costs a bug report. |

## Verification

- [x] `AGENTS.md` carries the rule, and the merge step in "Pull requests only" defers to it
- [x] The pull request template has the verification checkbox
- [x] The dev server runs on `127.0.0.1:5173` and serves the app
- [x] `5199` is left free for the Playwright suite
- [x] This change was opened as a pull request and left unmerged pending the owner's answer

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** the `AGENTS.md` rule, the pull request checkbox, and a dev server left running on
  <http://127.0.0.1:5173>.
- **Deviations from the plan:** none.
- **Follow-up specs:** none. If the port split proves annoying, a second dev port for the e2e suite would
  be the next change.
