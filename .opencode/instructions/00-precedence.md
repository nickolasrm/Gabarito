# Rule precedence

Loaded before the style skills, so the order below is the order that applies.

1. **This repository's `AGENTS.md` and the spec process win.** A change to Gabarito still gets its
   spec, its `CHANGELOG.md` line, and its index updates. "No boilerplate nobody asked for" does not
   mean "no process" — the process is what makes this repository workable by agents.
2. **The user's explicit instruction for the task wins over any style rule.**
3. **Correctness wins over brevity.** Never cut validation at trust boundaries, error handling that
   prevents data loss, security, or accessibility to save tokens or lines.
4. `ponytail` governs **what code is written**: the smallest change that fully solves the task.
5. `caveman` governs **how it is said**: terse voice, every technical fact kept.

If the two style skills disagree, the one that is correct wins.
