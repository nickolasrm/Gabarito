---
id: 0000
title: <short imperative phrase, e.g. "Use X for Y">
status: proposed          # proposed | accepted | superseded | deprecated | rejected
date: YYYY-MM-DD
tags: [area, area]         # lowercase, greppable: geometry, rendering, process, storage…
supersedes: []             # [0000] ids this makes obsolete
superseded_by: null        # 0000, set on the *old* record when this one is replaced
specs: []                  # specs that motivated or implemented this
---

# 0000 — <title>

<!--
Keep the whole record under ~80 lines. It is read one at a time, out of context, possibly years
from now. Write for that reader: no "currently", no "for now", no references to conversations.
Once accepted, this file is frozen.
-->

## Context

What situation forces a decision? Constraints, forces at play, what is being built. Include the
constraint that makes the obvious option unavailable.

## Decision

What we will do, stated in the active voice and present tense: "Gabarito uses X." One decision per
record. If you need "and", you probably need two records.

## Consequences

**Good:** what becomes easy or possible.

**Bad:** what becomes harder, slower, or impossible. Every decision costs something — name it.
Future agents will hit these costs, and this section is how they know it was deliberate.

**Neutral:** what changes shape without being better or worse.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Option A | … |
| Option B | … |

Be honest. "We did not think about it" is worse than a weak reason, because it hides the gap.

## Links

- Related decisions: 0000
- Specs: `docs/specs/0000-...`
- External: <references, if any>
