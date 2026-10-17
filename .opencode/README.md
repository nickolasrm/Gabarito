# .opencode

Agent configuration for this repository: two vendored style skills, forced on for every request.

## What is here

```
opencode.json                        instructions list — this is what forces the skills on
instructions/00-precedence.md        project rules beat the style skills
instructions/01-agent-mode.md        the levels: ultracave, ponytail ultra
skills/caveman/SKILL.md + LICENSE    vendored, unmodified
skills/ponytail/SKILL.md + LICENSE   vendored, unmodified
skills/ultracave/SKILL.md + LICENSE  vendored, unmodified
```

## Levels

`instructions/01-agent-mode.md` sets the levels and is the file to edit. It loads `ultracave` rather
than `caveman` — same rules, maximum compression, and 2.5 kB instead of 4.7 kB — and puts ponytail at
`ultra`. The weaker `caveman` skill stays registered, so `@caveman` still works when someone wants the
softer voice.

`megacave` is **not** installed. It is caveman in Classical Chinese, which is a change of language, not
of strength, and it does not fit this project.

Note that loading `ultracave` as an instruction bypasses upstream's `disable-model-invocation: true`,
which exists so the mode is only used when asked for. That is deliberate here — the owner asked for it
as the default — and it is the kind of upstream-intent override `instructions/00-precedence.md` exists
to make explicit.

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
| ultracave | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) `skills/ultracave/SKILL.md` | `main`, 2026-10-17 | `a8da5b0b3501b853e1b98f2ae09fe8dc9c0edf481b1d3fa9529f8557011c1ef8` |
| ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) `skills/ponytail/SKILL.md` | `main`, 2026-10-17 | `9badd22a32e19cb884e46dfa8d3aae82bb81dfa5484105b8b4f0262df823a509` |

Licences are vendored beside each skill: caveman and ultracave are Apache-2.0, ponytail is MIT.

To update one, re-fetch the upstream file, replace it, and update the hash above. Do not edit the
vendored files: a local edit makes the hash a lie and the next update silently reverts it.

## Known limitations

- **The two skills overlap.** Caveman compresses the *voice*; ponytail compresses the *diff*. Both are
  always-on, so their rules mix in every request. `instructions/00-precedence.md` settles who wins,
  and upstream has an open issue about token-compression skills stacking badly
  ([caveman#574](https://github.com/JuliusBrussee/caveman/issues/574)).
- **`/caveman wenyan` does not work here.** That alias defers to the upstream `megacave` skill, which
  is caveman in Classical Chinese — a change of language rather than of strength, so it is not
  vendored. `/caveman ultra` does work: `ultracave` is installed and is the default.
- **`ultracave` is loaded as an instruction, which bypasses its own `disable-model-invocation: true`.**
  That flag exists so the mode is only used when asked for. The owner asked for it as the default, so
  the override is deliberate and recorded in `instructions/01-agent-mode.md`.
- **Ponytail's `ultra` level includes push-back.** It is not only terser code: it also means questioning
  the request before building. Reach for `full` in `instructions/01-agent-mode.md` if that is too much.
- **The `ponytail-review`, `ponytail-audit` and `ponytail-debt` commands are not installed**, only the
  rules.

## Turn it off

- This project: delete the three entries from `opencode.json`.
- One session: say `stop caveman` or `normal mode`.
- Everywhere: see the global config in `~/.config/opencode/`.
