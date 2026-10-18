---
id: 0035
title: Record standing authorization for routine development work
status: implemented
date: 2026-10-18
packages: [docs]
decisions: [0009, 0017]
supersedes: null
---

# 0035 — Record standing authorization for routine development work

## Goal

Agents proceed with routine development work without asking for repeated confirmation. The owner
explicitly approved PR #14 and requested this policy in `AGENTS.md` in the same message.

## Plan

Document standing authorization to run/maintain/check the local server, run tests, stage and commit,
publish branches and create/update PRs, and check CI. An explicit implementation request accepts
its in-scope spec; do not add a separate spec-approval pause. Ask necessary clarifying questions
and obtain fresh owner approval for every merge. Approval already received for the current merge
is sufficient; do not ask twice. Preserve human verification, required checks and runtime permission
enforcement. Add this documentation update to the already approved PR #14 before merging it.

## Verification

Review the exact instructions for consistency with the merge gate and existing precedence rules.
Update the specs index and changelog. No runtime behavior or test expectations change.

## Result

Added the standing-authorization section and aligned the spec workflow with explicit implementation
requests. Routine work proceeds without repeated agent confirmation; necessary clarification, fresh
merge approval, human verification and enforced runtime permissions remain intact. Reviewed the
instructions and `git diff --check`; no runtime code or tests changed.
