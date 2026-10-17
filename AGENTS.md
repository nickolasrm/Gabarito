# AGENTS.md

This repository is written and maintained by AI agents. Humans steer, review, and merge.
Read this file first. Everything else in `docs/` is loaded on demand, in layers.

## The one rule

**No change lands without a spec.** Code, docs, config, a dependency bump — every change starts
as a plan in `docs/specs/` and is recorded there when it is done.

## Pull requests only

`main` is protected. Never commit to it, never push to it, never force-push it. Every change:

1. `git switch -c <type>/<slug>` — type is one of `feat`, `fix`, `docs`, `chore`, `refactor`, `test`,
   then a short slug, for example `docs/public-repo-rules`.
2. Push the branch and open the PR: `gh pr create --fill`, then edit the body so it links the spec.
3. Merge once the checks pass: `gh pr merge --squash --delete-branch`.

Rewriting published history is a one-off owner decision, asked for explicitly, never routine.

## Talking about other products

Name other tools as **inspiration** or for honest comparison. Never position this project against
them: no "free alternative to X", no "replaces X", no "X without the licence fee", no claim to be a
copy, clone or fork of another product. Say what we learned from a tool, not what we take from it.

This project is independent. It is not affiliated with, endorsed by, or a continuation of anything it
draws on, and it is not a replacement for any of it.

## Reading order (progressive disclosure)

Do not read the whole `docs/` tree. Read a layer only when the task needs it.

| # | When | Read |
|---|------|------|
| 0 | Always | this file |
| 1 | Always, once | `docs/README.md` — the router |
| 2 | Any code change | `docs/architecture/overview.md`, `docs/architecture/invariants.md` |
| 3 | Before deciding anything | `docs/decisions/README.md` (index only), then the 1–3 matching records |
| 4 | While doing the work | the spec you are executing, plus `docs/guides/` as needed |
| 5 | Touching a module | that module's `README.md` only |
| 6 | Domain feature work | `docs/features/README.md`, then that one feature file |

Stop there. If starting a task needs more than ~5 files, the router is broken — say so instead of
reading everything.

## Workflow

1. **Search before deciding.** `rg -i '<keyword>' docs/decisions`
2. **Write the spec** from `docs/specs/TEMPLATE.md` as `docs/specs/NNNN-slug.md` with status
   `proposed`. One change per spec. Small. Link the decisions it relies on.
3. **Get it accepted** (user approval) → status `accepted`.
4. **Implement** inside the spec's scope. If scope must change, update the spec *first*.
5. **Close the spec**: status `implemented`, add a `## Result` section describing what actually
   shipped and any deviation from the plan.
6. **Record decisions** you made that future agents must honour as an ADR in `docs/decisions/`.
   Never edit an accepted ADR — supersede it with a new one.
7. **Document the change**: append to `CHANGELOG.md` and update every index table you touched.
8. **Open a pull request** — never commit to `main` (see [Pull requests only](#pull-requests-only)).

## Commit format

```
<type>(<scope>): <summary>

Spec: docs/specs/0007-viewport-picking.md
```

`<scope>` is a package name (`core`, `geometry`, `scene`, `tools`, `ui`, `persistence`,
`plugin-api`, `plugin-host`, `app`, `web`, `woodworking`, `lighting`, `house`) or `docs`.

## Definition of done

- [ ] Spec exists, is `implemented`, and describes what actually shipped
- [ ] `CHANGELOG.md` updated
- [ ] Index tables updated: `docs/specs/README.md`, and `docs/decisions/README.md` if an ADR was added
- [ ] No import violates `docs/architecture/module-boundaries.md`
- [ ] New public interface documented in the owning package's `README.md`
- [ ] Tests written per `docs/guides/testing.md`
- [ ] Build still produces a **static** bundle that needs no server
- [ ] No text claims this project replaces, clones, or competes with another product
- [ ] The change landed through a pull request, not a direct commit to `main`

## Settled constraints — do not re-litigate

- Hosted on GitHub Pages. Static files only. No server, no API routes, no secrets in the repo.
- No server-side rendering. The app works opened from static hosting.
- Local-first: no implicit uploads, core editing works offline.
- Boundaries are enforced by directory: `apps/web` composes, `packages/*` implement.
- Features (woodworking, lighting, house building) are plugins and never fork the core.

## Editing docs

- One concept per file. Past ~90 lines (architecture, decisions) or ~150 (specs), split it.
- Every ADR and spec carries YAML front matter — it is what makes them searchable. Do not skip it.
- Adding a file without adding it to an index table in the same commit is a bug.

## Search cheatsheet

```bash
rg -i 'topic' docs/decisions                    # full text of decisions
rg '^tags:.*render' docs/decisions               # decisions by tag
rg '^status: accepted' docs/decisions            # settled decisions only
rg '^status: (proposed|accepted)' docs/specs     # open work
rg -i 'topic' CHANGELOG.md                       # when did this change
```
