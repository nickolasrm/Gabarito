# .opencode

Agent configuration for this repository: two vendored style skills, forced on for every request.

## What is here

```
opencode.json                        instructions list — this is what forces the skills on
instructions/00-precedence.md        project rules beat the style skills
skills/caveman/SKILL.md + LICENSE    vendored, unmodified
skills/ponytail/SKILL.md + LICENSE   vendored, unmodified
```

## Why `instructions` and not just skills

A skill is **on-demand by design**. OpenCode advertises a skill by its `description` and the agent
decides whether to load it, precisely so that "every skill" does not end up in "every prompt". A
skill alone therefore cannot be guaranteed on every request.

`instructions` is the channel that *is* in context for every request, so both skill bodies are listed
there and are also registered as skills (so `@caveman` and `@ponytail` still work explicitly).

Cost of this choice: each body is in context for every request — roughly 8 kB of rules — and the
skill is advertised in the model's skill list as well. If a request needs the budget back, remove the
entry from `opencode.json`; the skill stays available on demand.

## Provenance

Vendored unmodified from upstream. Verify with `sha256sum`:

| Skill | Source | Version fetched | sha256 of `SKILL.md` |
|---|---|---|---|
| caveman | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) `skills/caveman/SKILL.md` | `main`, 2026-10-17 | `415d43518f2b1a9498c15a445d4657117b129ee5e81b19454ce348439cc6672b` |
| ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) `skills/ponytail/SKILL.md` | `main`, 2026-10-17 | `9badd22a32e19cb884e46dfa8d3aae82bb81dfa5484105b8b4f0262df823a509` |

Licences are vendored beside each skill: caveman is Apache-2.0, ponytail is MIT.

To update one, re-fetch the upstream file, replace it, and update the hash above. Do not edit the
vendored files: a local edit makes the hash a lie and the next update silently reverts it.

## Known limitations

- **The two skills overlap.** Caveman compresses the *voice*; ponytail compresses the *diff*. Both are
  always-on, so their rules mix in every request. `instructions/00-precedence.md` settles who wins,
  and upstream has an open issue about token-compression skills stacking badly
  ([caveman#574](https://github.com/JuliusBrussee/caveman/issues/574)).
- **`/caveman ultra` and `/caveman wenyan` do not work here.** The caveman body defers those aliases
  to the upstream `ultracave` and `megacave` skills, which are not vendored. Only the default voice is
  installed.
- **The `ponytail-review`, `ponytail-audit` and `ponytail-debt` commands are not installed**, only the
  rules.

## Turn it off

- This project: delete the three entries from `opencode.json`.
- One session: say `stop caveman` or `normal mode`.
- Everywhere: see the global config in `~/.config/opencode/`.
