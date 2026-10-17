---
id: 0014
title: Raise the agent modes to ultracave and ponytail ultra
status: implemented
date: 2026-10-17
packages: [docs]
decisions: []
supersedes: null
---

# 0014 — Raise the agent modes to ultracave and ponytail ultra

## Goal

Run the two always-on style skills at their strongest settings: `ultracave` instead of `caveman`, and
`ponytail` at `ultra`.

## Why now

Requested. [Spec 0010](./0010-force-style-skills-on.md) installed the upstream defaults and recorded
that the stronger caveman variants were not installed. This closes that gap.

There is a measurable reason beyond the request. `ultracave` is the same rules with the grammar
stripped, and its body is 2.5 kB against caveman's 4.7 kB, so every request gets a stronger voice and
carries less context — the rare change that is strictly better on both axes.

## Scope

**In scope**

- Vendor `ultracave` unmodified beside the existing skills, with its licence.
- Load it as the always-on caveman body **in place of** `caveman`, in the repository and globally.
- A new `instructions/01-agent-mode.md` in both places: the levels live there, not in vendored files.
- Record the hashes and the two consequences — upstream's `disable-model-invocation` is bypassed, and
  ponytail `ultra` adds push-back.

**Out of scope**

- `megacave`. Classical Chinese is a change of *language*, not of strength, and upstream itself says its
  token savings are "small and noisy".
- Ponytail's `-review`, `-audit`, `-debt` command skills.
- Editing any vendored body.

## Plan

1. Fetch and vendor `ultracave` plus its licence; check the hash against upstream.
2. Load `ultracave` in `instructions` instead of `caveman`, keeping both skills registered so
   `@caveman` still works.
3. Add `instructions/01-agent-mode.md` in the repository and globally.
4. Update `.opencode/README.md`: provenance row, a levels section, and the changed limitations.
5. Verify the modes load, then land it through a pull request.

## Design notes

**The level could not go in the skill body.** The bodies are pinned by hash: editing one to say "use
ultra" would make the hash a lie and be silently reverted by the next upstream update. A file beside
them states the level, and that file is what to edit.

**Only one caveman body loads.** `caveman`'s own text says that for `/caveman ultra` you should follow
`ultracave` instead of it, so loading both would be contradictory. `ultracave` replaces it as the
default; `caveman` stays registered as the softer voice.

**`ultra` is not only terser.** Ponytail's strongest level also means questioning the request before
building. That is what "stronger" asks for here, and it is stated where the level is set so a future
reader can turn it down deliberately.

## Risks

| Risk | Mitigation |
|---|---|
| Bypassing `disable-model-invocation` surprises a future reader | Recorded as a deliberate owner override in both the README and the mode file. |
| Stronger compression drops a fact | `ultracave`'s own Floor forbids cutting negation, numbers, units, paths and error strings, and `00-precedence.md` still outranks it. |
| Ponytail `ultra` push-back reads as obstruction | One line in `instructions/01-agent-mode.md` returns it to `full`. |
| A vendored body edited later, breaking the pin | The README says not to, and records the hash of every vendored file. |

## Verification

- [x] `ultracave` vendored in the repository and globally; both hashes equal upstream and each other
- [x] Both configs load `ultracave` and the mode file, and no longer load `caveman`
- [x] Both configs parse
- [x] Repository link, budget and index checks pass
- [x] The six interaction fixes are still live on <http://127.0.0.1:5173>
- [x] Landed through a pull request, left unmerged pending the owner

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** `ultracave` vendored in both places, loaded in place of `caveman`;
  `instructions/01-agent-mode.md` in both places setting `ultracave` and ponytail `ultra`; the README
  updated with the third provenance row, the levels section, and the three changed limitations.
- **Deviations from the plan:** `megacave` was not installed, as the scope said. `caveman` was kept
  vendored rather than removed.
- **Follow-up specs:** none requested. Ponytail's command skills remain uninstalled.
