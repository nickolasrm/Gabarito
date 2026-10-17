## Spec

<!-- Required. A pull request without a spec is not mergeable. -->

- Spec: `docs/specs/`

## What changed

<!-- One or two sentences. What is different after this merges? -->

## Why

<!-- Link the decision records this relies on, or the new ADR it added. -->

## Scope check

<!-- Confirm the change stayed inside the spec. If it did not, the spec was updated first. -->

- [ ] The spec above is `implemented` and describes what actually shipped
- [ ] Any deviation from the plan is written in the spec's `## Result` section

## Checklist

- [ ] `CHANGELOG.md` updated
- [ ] Index tables updated (`docs/specs/README.md`, `docs/decisions/README.md`)
- [ ] New decision recorded as an ADR, or an existing one superseded (never edited)
- [ ] No import violates `docs/architecture/module-boundaries.md`
- [ ] New public interface documented in the owning package's `README.md`
- [ ] Tests added or updated per `docs/guides/testing.md`
- [ ] Build output is static and needs no server
- [ ] No text claims this project replaces, clones, or competes with another product
- [ ] Opened as a pull request — never a direct commit to `main`
- [ ] The owner verified the change on <http://127.0.0.1:5173> and said it can merge

## How to verify

<!-- Exact commands, and what to look at. -->
