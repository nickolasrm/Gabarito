---
id: 0001
title: Bootstrap the repository structure
status: implemented
date: 2026-10-17
packages: [docs]
decisions: [0001, 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011]
supersedes: null
---

# 0001 — Bootstrap the repository structure

## Goal

Create the repository that governs the project: the agent rules, the layered `docs/` structure, the
empty module boundaries, and the decision records that everything after this will be built against.
No implementation code.

## Why now

Agents cannot start work without a place to record plans and decisions. Setting up the structure
first, and writing the foundational decisions before any code exists, is the cheapest possible moment
to do both — and it means the first line of real code will already have a boundary to live inside.

## Scope

**In scope**

- `AGENTS.md`: the single always-read file, with the workflow, commit format, and definition of done.
- `docs/`: router, glossary, architecture, decisions, specs, guides, features.
- Eleven decision records plus a template, covering hosting, stack, rendering, layout, plugins,
  document model, persistence, units, documentation workflow, testing, and the proposed geometry
  kernel strategy.
- Empty module boundaries: `apps/web` and `packages/*`, each with a `README.md` describing its
  responsibility, ownership, and dependency rules.
- Repository hygiene: `README.md`, `CHANGELOG.md`, `.gitignore`, `.nojekyll`, PR template.

**Out of scope**

- Any implementation code.
- Any dependency manifest, bundler config, TypeScript config, or CI workflow. Those are
  [spec 0002](./0002-monorepo-tooling-bootstrap.md).
- The geometry kernel choice, which stays `proposed` in [decision 0011](../decisions/0011-geometry-kernel-strategy.md).
- Any feature work on woodworking, lighting, or house building.

## Plan

1. Root files: `README.md`, `AGENTS.md`, `CHANGELOG.md`, `.gitignore`, `.nojekyll`,
   `.github/pull_request_template.md`.
2. `docs/README.md` as the only index, plus `docs/glossary.md`.
3. `docs/architecture/`: overview, invariants, module boundaries, plugin contract.
4. `docs/decisions/`: template, index, records 0001–0011.
5. `docs/specs/`: template, index, and the first specs.
6. `docs/guides/`: writing a spec, writing an ADR, testing.
7. `docs/features/`: router plus one file per planned domain.
8. `packages/` and `apps/web`: one `README.md` per boundary, no code.
9. Create the private GitHub repository and push.

## Design notes

The tree is organised for **progressive reads**: the always-read file is one page, the router is an
index, and every other file is opened only when its task demands it. Decision records are small,
tagged, and append-only so that old reasoning stays findable by search rather than by memory.

Module boundaries are established as directories with READMEs but no code, so that the first
implementation spec has an obvious home and an obvious set of import rules — see
[decision 0004](../decisions/0004-repository-layout.md).

## Risks

| Risk | Mitigation |
|---|---|
| Documentation set up now drifts from reality as code lands | The definition of done requires updating docs in the same commit as the change. |
| Too much structure before any code discourages the first contributor | Structure is small files with a router; the first spec only needs to read two of them. |
| Decision records written before implementation turn out wrong | They are supersedable by design; [0011](../decisions/0011-geometry-kernel-strategy.md) is deliberately `proposed` rather than `accepted`. |
| Empty package folders look like abandoned scaffolding | Each carries a `README.md` stating its status and the spec that will fill it. |

## Verification

- [x] `AGENTS.md`, `docs/`, `packages/`, `apps/` exist with the described files
- [x] Every decision record appears in `docs/decisions/README.md`
- [x] Every spec appears in `docs/specs/README.md`
- [x] No file exceeds its size budget
- [x] The private GitHub repository exists and the initial commit is pushed
- [x] The repository contains no implementation code or dependency manifest

## Docs to update

- [x] `CHANGELOG.md` entry
- [x] `docs/specs/README.md` index row
- [x] `docs/decisions/README.md` index rows

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** the full documentation structure described above, with 11 accepted-or-proposed
  decision records, 3 specs, 4 architecture pages, 3 guides, 4 feature docs, and 13 module READMEs
  under `apps/` and `packages/`. Repository created as a private GitHub repository.
- **Deviations from the plan:** none of substance. A `docs/guides/README.md` router was added for
  consistency with the other directories.
- **Follow-up specs:** [0002](./0002-monorepo-tooling-bootstrap.md) (tooling and static build),
  [0003](./0003-geometry-kernel-spike.md) (kernel choice), and the first core implementation spec.
