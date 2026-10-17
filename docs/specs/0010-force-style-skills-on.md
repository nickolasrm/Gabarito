---
id: 0010
title: Force the caveman and ponytail style skills on
status: implemented
date: 2026-10-17
packages: [docs]
decisions: []
supersedes: null
---

# 0010 — Force the caveman and ponytail style skills on

## Goal

Make two third-party agent style skills — **caveman** (terse voice, all technical substance kept) and
**ponytail** (the smallest change that fully solves the task) — present in this repository and active
on **every** request, not merely available on demand.

## Why now

Requested directly. Both are widely used and cheap to adopt: caveman cuts output tokens, ponytail cuts
the size of a diff.

There is a real conflict to settle in the same change. This repository is run by agents under a
documentation process, and ponytail's "skip options and boilerplate nobody asked for" rule reads, to a
literal-minded agent, as licence to skip the spec and the decision record. A style skill must not be
able to override the process that makes the repository work, so precedence is part of this change
rather than a follow-up.

## Scope

**In scope**

- Vendor both skills **unmodified** under `.opencode/skills/<id>/`, with their licences.
- Force both on for every request through the `.opencode/opencode.json` `instructions` array.
- A precedence file that puts `AGENTS.md` and the spec process above both style skills.
- `.opencode/README.md`: provenance, sha256 hashes, limitations, and how to turn it off.

**Out of scope**

- The upstream caveman CLI and proxy: Blocks, Auto routing, browse, telemetry, compression.
- The `ultracave` and `megacave` aliases, and the `ponytail-review` / `-audit` / `-debt` commands.
- The global user configuration. That is not a repository change and is handled separately.
- Editing or "improving" the vendored text.

## Plan

1. Fetch each skill's `SKILL.md` and licence from upstream and record the sha256 of the body.
2. Vendor them under `.opencode/skills/<id>/`.
3. Write `.opencode/instructions/00-precedence.md`.
4. Add `.opencode/opencode.json` listing the precedence file and both skill bodies as instructions.
5. Write `.opencode/README.md`.
6. Confirm the skills are registered, and that the repository's link and size checks still pass.

## Design notes

**A skill cannot be forced.** A skill is on-demand by design: OpenCode lists it by `description` and
the agent chooses whether to load it, deliberately so that every skill does not land in every prompt.
`instructions` is the channel that is in context for every request, so the two bodies are listed there
*and* registered as skills — listed for the guarantee, registered so `@caveman` and `@ponytail` still
work explicitly.

**The cost is real and was accepted.** Each body is in context for every request (~8 kB of rules), and
the skill is advertised in the model's list as well. Removing the entries from `instructions` restores
the on-demand behaviour without deleting anything.

**Provenance over paraphrase.** The bodies are fetched verbatim and pinned by hash. A locally edited
copy would make the hash a lie and be silently reverted by the next update.

## Risks

| Risk | Mitigation |
|---|---|
| Ponytail read as "skip the spec and the ADR" | Precedence point 1: `AGENTS.md` and the spec process win; "no boilerplate" never means "no process". |
| Two always-on compression skills mixing badly | Precedence splits them by axis: ponytail owns the diff, caveman owns the voice. Upstream has an open issue about skills stacking, so this is a known area. |
| Vendored text drifting from upstream | sha256 recorded in `.opencode/README.md`; the files are never edited in place. |
| Every request carrying extra context | Measured in the README, reversible with a one-line edit. |
| Someone assuming caveman's `ultra` and `wenyan` aliases exist | Documented as not installed. |

## Verification

- [x] `.opencode/opencode.json` lists all three instruction files
- [x] Both skills appear in the agent's skill list with their upstream descriptions
- [x] sha256 of each vendored `SKILL.md` matches the recorded value
- [x] Repository link and size-budget checks still pass
- [x] Turning it off is a documented edit of one file

## Docs to update

- [x] `CHANGELOG.md` entry
- [x] `docs/specs/README.md` index row
- [x] `.opencode/README.md` (provenance and limitations)

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** `.opencode/skills/caveman/` and `.opencode/skills/ponytail/` (each `SKILL.md` plus
  its licence, unmodified), `.opencode/instructions/00-precedence.md`, `.opencode/opencode.json`, and
  `.opencode/README.md`. OpenCode registered both skills on the next step.
- **Deviations from the plan:** none. The global installation in `~/.config/opencode` was done in the
  same session but is deliberately not part of this spec: it is user configuration, not a repository
  change, and it uses `~/`-absolute paths rather than the repository-relative ones here.
- **Follow-up specs:** none. If the two skills prove to fight in practice, the next change is to drop
  one from `instructions` rather than to edit either body.
