---
id: 0003
title: Spike the geometry kernel candidates
status: proposed
date: 2026-10-17
packages: [geometry]
decisions: [0011, 0003, 0008]
supersedes: null
---

# 0003 — Spike the geometry kernel candidates

## Goal

Run a time-boxed comparison of at least two mesh-boolean candidates against two representative cases,
and produce the evidence needed to accept or reject [decision 0011](../decisions/0011-geometry-kernel-strategy.md).
The spike's deliverable is a decision, not production code.

## Why now

Everything geometric depends on this: push/pull, wall openings, joinery cuts. Choosing by intuition
and discovering the limitations after the document model is built means reworking topology,
serialisation, and every tool. The spike is small, and it prevents a large class of rework.

## Scope

**In scope**

- A throwaway harness (not in `packages/geometry`) that runs a fixed set of operations under each
  candidate.
- Two cases, taken from the real target domains:
  1. **Push/pull a box**, then cut a rectangular recess into one face.
  2. **Wall with a door opening**: subtract a box from a wall slab, then measure the result.
- Measurements per candidate: bundle size (raw and gzipped), wall-clock time, robustness on coplanar
  and near-degenerate inputs, licence, WASM availability, maintenance activity, and TypeScript story.
- A written comparison and a recommendation, either to accept 0011 as written or to supersede it.

**Out of scope**

- Any production API in `packages/geometry`.
- Half-edge topology implementation. The spike only tests whether a candidate gives us something
  worth wrapping.
- Rendering integration, undo, serialisation, UI.
- Exact/curved surfaces and filleting.

## Plan

1. Enumerate candidates. Expected shortlist: a `three-bvh-csg`-style JS library, `manifold` (WASM),
   and `csg.js`-family as a baseline.
2. Build the harness with the two cases as reproducible scripts with timing and output-stats capture.
3. Record bundle-size impact of each candidate in a production-like Vite build.
4. Push each candidate on deliberately nasty inputs — coplanar faces, near-zero-thickness walls,
   duplicated vertices — and record artefacts and failures honestly.
5. Verify licences and check recent release activity.
6. Write the comparison into the spec's `## Result`, and either accept
   [0011](../decisions/0011-geometry-kernel-strategy.md), amend it, or supersede it with a new record.
7. Delete the harness, or promote the reusable parts with a follow-up spec.

## Design notes

The spike must run in a browser-equivalent bundle, not Node, because the static-hosting constraint
([decision 0001](../decisions/0001-static-hosting-github-pages.md)) makes bundle size a product
requirement. A candidate that is excellent but adds several megabytes is not excellent.

Robustness should be judged on the *inputs we will actually see*: architectural walls and millimetre
joinery, not pathological synthetic meshes. Report artefacts with screenshots or statistics, not
impressions.

## Risks

| Risk | Mitigation |
|---|---|
| The spike expands into building a kernel | Time-box it, and keep the harness outside `packages/geometry` so it cannot fossilise into production code. |
| Both candidates fail on realistic inputs | That is a valid result: it moves the recommendation toward a WASM kernel and is worth knowing now. |
| Results do not transfer to production usage | Use the two domain-derived cases rather than synthetic benchmarks. |
| An agent quietly implements a production API during the spike | Success criteria are a comparison document and a decision, nothing else ships. |

## Verification

- [ ] Both cases run under every shortlisted candidate
- [ ] Bundle size measured in a production build, not a dev build
- [ ] Artefacts on degenerate inputs recorded with reproducible inputs
- [ ] Licences confirmed and quoted
- [ ] A recommendation exists, and [0011](../decisions/0011-geometry-kernel-strategy.md) is accepted,
      amended, or superseded accordingly
- [ ] The harness is removed or a follow-up spec covers promoting it

## Docs to update

- [ ] `CHANGELOG.md` entry
- [ ] `docs/specs/README.md` index row and status
- [ ] `docs/decisions/0011-geometry-kernel-strategy.md` status, or a new superseding record
- [ ] `docs/decisions/README.md` if a record is added
- [ ] `docs/architecture/overview.md` if the kernel changes the module picture

## Result

> Filled in when the spec is closed.
