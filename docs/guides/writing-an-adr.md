# Writing an ADR

A decision record explains **why** something is the way it is, for an agent reading it years from now
with no conversation to refer to. Read this before adding a file to `docs/decisions/`.

## When to write one

Write an ADR when the decision:

- constrains future changes (a convention, a boundary, a format, a dependency),
- is expensive to reverse (a file format, a coordinate system, a hosting model),
- had a real alternative that a reader would wonder about,
- is likely to be questioned by a future agent — which is exactly when the *reasoning* matters more
  than the decision.

Do **not** write one for: a local implementation choice inside one file, a temporary workaround, or
anything already covered by an existing record.

If you are debating whether it deserves a record, it probably does.

## How

1. Copy [`../decisions/0000-template.md`](../decisions/0000-template.md) to
   `docs/decisions/NNNN-slug.md` with the next free number.
2. Fill in the front matter. `tags` are the retrieval key — choose lowercase, reusable words
   (`geometry`, `rendering`, `process`, `storage`), not sentences.
3. Write the sections below, then add a row to the index in
   [`../decisions/README.md`](../decisions/README.md).

## What makes a record good

**Context** explains the forcing constraint, not the history. A reader should be able to answer
"what made this necessary?" without the surrounding project knowledge.

**Decision** is one decision, active voice, present tense. "Gabarito uses X." If you need "and", it is
two records.

**Consequences** is the honest section. Name what becomes worse. Every decision costs something; an
ADR that lists only benefits is advocacy, not a record, and future agents will discover the costs
anyway — without knowing they were deliberate.

**Alternatives considered** lists real options with real reasons, including the one you almost chose.
"The obvious option" and why it is unavailable is often the most valuable line in the record.

## The immutability rule

Accepted records are **never edited**. Not to fix a typo in the reasoning, not to update a link's
description, not because things changed.

To change a decision:

1. Write a new record that states the new decision.
2. In the new record's front matter, set `supersedes: [0005]`.
3. In the **old** record's front matter, set `status: superseded` and `superseded_by: 0012`. This is
   the only edit ever permitted to an accepted record.
4. Update both rows in the index.

The old record stays readable forever. That is the point: "why did we stop doing X?" is answered by
reading the record that superseded it, and "why did we ever do X?" is answered by the record itself.

## Size

Under ~90 lines. If your record is longer, you are describing implementation, which belongs in a
spec, or you are covering two decisions, which belong in two records.

## Checklist

- [ ] Number is the next free one, never reused
- [ ] Front matter complete, including `tags`
- [ ] Exactly one decision, stated in the present tense
- [ ] Consequences name the honest downsides
- [ ] Alternatives are real options with real reasons
- [ ] Index row added in `docs/decisions/README.md`
- [ ] Old record marked `superseded` with `superseded_by` if this replaces one
- [ ] `CHANGELOG.md` updated if the decision changed the product
