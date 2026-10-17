# Changelog

Every notable change to this repository is recorded here. This file is a **summary**; the
authoritative record of a change is its spec in [`docs/specs/`](./docs/specs/README.md).

Convention: one entry per implemented spec, added in the same commit, with a link back to the
spec. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Repository bootstrap: `AGENTS.md`, the layered `docs/` structure (architecture, decision
  records, specs, guides, features), and empty module boundaries for `apps/web` and
  `packages/*`. No implementation code. — [spec 0001](./docs/specs/0001-bootstrap-repository-structure.md)
- Monorepo tooling and the static build: strict TypeScript, Vite (relative base, static output),
  Vitest, and a GitHub Pages deployment workflow. — [spec 0002](./docs/specs/0002-monorepo-tooling-bootstrap.md)
- `packages/geometry`: vectors, planes, rays, segments, polygons, ear-clipping triangulation,
  extrusion, transforms, bounds, and named tolerances. Pure, headless, zero dependencies.
  — [spec 0004](./docs/specs/0004-core-document-geometry-viewport.md)
- `packages/core`: the document entity graph (points, edges, faces, guides, dimensions), commands
  with inverses, undo/redo, selection, settings, unit parsing and formatting, automatic face
  closure from a loop of edges, and extrusion into closed solids.
  — [spec 0004](./docs/specs/0004-core-document-geometry-viewport.md)
- `packages/scene`: the Three.js viewport, spherical Z-up camera with middle-drag orbit and
  wheel zoom, document-derived scene building, analytic picking, and projection helpers.
  — [spec 0008](./docs/specs/0008-camera-navigation.md)
- `packages/tools`: the tool state machine contract, the shared typed-value and axis-lock input
  layer, the inference engine (endpoints, midpoints, edges, guides, virtual intersections,
  extensions, inferred axes), and nine tools: select, line, rectangle, circle, push/pull, move,
  rotate, ruler, measure. — [specs 0006](./docs/specs/0006-snapping-inference-axis-locks.md),
  [0007](./docs/specs/0007-drawing-and-transform-tools.md)
- `packages/ui` and `packages/app`: the React chrome (toolbar, settings panel, status bar with the
  typed buffer and live measurements) and the composition root with the global keymap.
- Unit selection across `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`, driving both typed input and
  every readout, with an explicit suffix overriding the current unit.
  — [spec 0005](./docs/specs/0005-units-and-measurement.md)
- End-to-end tests in a real browser (Playwright): boot without console errors, draw by click, type
  a size and apply it, push/pull, axis-locked move, rotate, guides, measure, undo, and Escape.
  — [decision 0010](./docs/decisions/0010-testing-strategy.md)

### Changed

- Module boundaries: `core` may now import `geometry`. `geometry` and `plugin-api` remain leaves.
  — [decision 0015](./docs/decisions/0015-core-depends-on-geometry.md)

### Removed

- **Pruned two speculative specs** written before any implementation was requested and never
  executed: `docs/specs/0003-geometry-kernel-spike.md` (a kernel comparison the shipped feature set
  does not need — see [decision 0011](./docs/decisions/0011-geometry-kernel-strategy.md), now
  `rejected`) and `docs/specs/0009-boundary-core-depends-on-geometry.md` (a one-line internal rule
  change whose content lives in [decision 0015](./docs/decisions/0015-core-depends-on-geometry.md)
  and [`docs/architecture/module-boundaries.md`](./docs/architecture/module-boundaries.md)).
  Spec numbers are not reused, so the gaps stay gaps. References in other documents were repaired.


<!--
Keep the entries above the fold. When a change ships:
  - Added / Changed / Deprecated / Removed / Fixed / Security
  - append `- <what changed>. — spec NNNN` with a relative link to the spec file
-->
