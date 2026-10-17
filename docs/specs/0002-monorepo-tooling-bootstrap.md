---
id: 0002
title: Bring up monorepo tooling and the static build
status: proposed
date: 2026-10-17
packages: [web, app, core]
decisions: [0001, 0002, 0004]
supersedes: null
---

# 0002 — Bring up monorepo tooling and the static build

## Goal

Make the repository buildable and deployable: a workspace layout, strict TypeScript, a Vite build
that produces a static bundle, a placeholder app that renders nothing but boots and reports its
version, and a GitHub Pages deployment. After this spec, the project is shippable but does nothing.

## Why now

Every subsequent spec needs a build, a test runner, and a deploy target. This is the smallest change
that establishes all three without implementing any product behaviour. It also validates the hosting
assumptions in [decision 0001](../decisions/0001-static-hosting-github-pages.md) — base paths,
`.nojekyll`, and the deep-link fallback — while the build is trivial enough to debug.

## Scope

**In scope**

- npm workspaces (or pnpm if the tooling spec prefers it) covering `apps/*` and `packages/*`.
- Strict TypeScript base config, plus per-package configs extending it.
- Vite dev server and production build for `apps/web`, emitting a static `dist/`.
- Base-path handling (`base: './'`), `.nojekyll` propagation, and the deep-link fallback mechanism.
- Vitest wired up with a single example test per existing package boundary that proves isolation.
- eslint + prettier, runnable from the root.
- A GitHub Actions workflow that builds and deploys to Pages.
- A placeholder `packages/app` entry point that boots and logs its version, plus the `apps/web` HTML
  shell.

**Out of scope**

- Any document model, geometry, rendering, tools, or UI. Those are separate specs.
- The plugin loader implementation — only the build's code-splitting capability is exercised.
- Runtime dependency choices beyond what the shell needs.
- The `.gabarito` file format.

## Plan

1. Add a root `package.json` with workspaces and root scripts (`dev`, `build`, `test`, `lint`,
   `typecheck`).
2. Add `tsconfig.base.json` and per-package `tsconfig.json` that map `@gabarito/*` to source.
3. Add `apps/web`: `index.html`, a Vite config, and a `main.ts` that imports `@gabarito/app`.
4. Add the placeholder `packages/app` with a `version` export and a `boot()` that the shell calls.
5. Add Vitest with one boundary test asserting `core` and `geometry` have no DOM or `three` imports
   ([invariant 7](../architecture/invariants.md)).
6. Add eslint/prettier configs and fix whatever they report.
7. Add `.github/workflows/deploy.yml` that builds and publishes the Pages artifact.
8. Enable Pages in the repository settings (or document the manual step if the token cannot).
9. Update the affected package `README.md` files with their new scripts and public entry points.

## Design notes

The interesting constraint is that `base` must work for both a project Pages URL and a local file
server, which is why it is set to a relative path. The deep-link fallback is settled here rather than
in a routing spec because it is a hosting property, not an application property; the chosen mechanism
(hash routing versus a `404.html` copy) should be recorded as an ADR if it constrains routing later.

## Risks

| Risk | Mitigation |
|---|---|
| Workspace tooling churn slows every later spec | Keep the root config minimal; no task runner until build time actually hurts. |
| The Pages workflow fails only at deploy time | Deploy the placeholder app first, before there is anything to break. |
| Strict TypeScript blocks exploratory geometry code later | Strictness is a base config; targeted, documented relaxations are allowed per package via a spec. |
| Agents run tests for the wrong package | Each package README states its own `test` script and scope. |

## Verification

- [ ] `npm run typecheck`, `npm run lint`, and `npm test` pass from a clean clone
- [ ] `npm run build` emits a static `dist/` that contains no server code
- [ ] The built site loads from a subpath and from `file://`-style static serving
- [ ] The deployment workflow publishes successfully and the Pages URL loads
- [ ] The boundary test fails if a `three` import is added to `geometry`
- [ ] `CHANGELOG.md` and every index table updated

## Docs to update

- [ ] `CHANGELOG.md` entry
- [ ] `docs/specs/README.md` index row
- [ ] `apps/web/README.md` and each changed package `README.md`
- [ ] `docs/decisions/` if routing or deploy specifics become settled constraints
- [ ] `README.md` status line: no longer "pre-implementation"

## Result

> Filled in when the spec is closed.
