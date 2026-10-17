# Writing a spec

A spec is a small plan for one change. It is written before the work and closed after it. If you
remember one thing: **the spec is the unit of scope** — "stay inside the spec" is how scope creep is
detected.

## Before writing

1. **Search for the decision.** `rg -i '<keyword>' docs/decisions`. If a record already answers your
   question, cite it instead of re-deciding.
2. **Search for prior work.** `rg -i '<keyword>' docs/specs`. A `implemented` spec on this topic
   tells you the shape of what exists; a `rejected` one tells you why it was refused.
3. **Check the boundary.** Where does this change live? See
   [`../architecture/module-boundaries.md`](../architecture/module-boundaries.md). If the answer is
   "nowhere", you probably need a boundary change — that is a decision record first.

## Writing

Copy [`../specs/TEMPLATE.md`](../specs/TEMPLATE.md) to `docs/specs/NNNN-slug.md`, where `NNNN` is the
next free number. Numbering is sequential and never reused.

Rules:

- **One change per spec.** If your plan has two independent deliverables, it is two specs.
- **Under ~150 lines.** A spec that needs more is under-designed or over-scoped.
- **The `Out of scope` section is mandatory and load-bearing.** List what a reader would reasonably
  expect and that you are deliberately not doing. This is the section agents use most.
- **Front matter is mandatory.** `id`, `title`, `status`, `date`, `packages`, `decisions`, `supersedes`.
- **Link decisions by number**, not by URL, in prose: "per decision 0006".
- **Name the tests** in `Verification`. "Test it" is not verification.

## Status transitions

```
proposed ──(approval)──► accepted ──(work done)──► implemented
    │
    └──► rejected                    implemented ──► superseded (by a later spec)
```

- `proposed` → `accepted` requires **human approval**. An agent must not approve its own spec.
- `accepted` → `implemented` happens in the same commit as the work, together with the `## Result`.
- If the plan changed mid-flight, update the spec **first**, then implement. Never let the plan and
  the code disagree silently.

## Closing a spec

1. Set `status: implemented`.
2. Fill in `## Result` — what actually shipped, and any deviation from the plan. Deviations are
   expected; hiding them is not.
3. List follow-up specs you uncovered.
4. Append a `CHANGELOG.md` entry linking to the spec.
5. Update the index table in [`../specs/README.md`](../specs/README.md).
6. If you made a durable decision, write an ADR
   ([`writing-an-adr.md`](./writing-an-adr.md)).
7. Update the package `README.md` files whose public interface changed.

## Common mistakes

| Mistake | Fix |
|---|---|
| Spec describes implementation in detail | Describe outcomes; leave the design notes short. Detail rots fastest. |
| No `Out of scope` | Fill it in. It is what makes review possible. |
| Spec approved and implemented by the same agent, same minute | Get explicit human approval; record it in the PR. |
| Spec left `accepted` after the code lands | Close it. The index lies otherwise. |
| Verification is "tests pass" | Name the tests and the manual check. |
| Decision embedded in a spec | Promote it to an ADR so it survives the spec. |
