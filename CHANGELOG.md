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
- Two vendored agent style skills, forced on for every request: **caveman** (terse voice) and
  **ponytail** (smallest complete change), with a precedence file that keeps `AGENTS.md` and the
  spec process above both. — [spec 0010](./docs/specs/0010-force-style-skills-on.md)
- Published the app: <https://nickolasrm.github.io/Gabarito/>, rebuilt and redeployed on every push to
  `main`. — [spec 0011](./docs/specs/0011-repository-goes-public.md)
- Two rules for a public repository: name other tools as inspiration rather than as a replacement, and
  land every change through a pull request. — [decisions
  0016](./docs/decisions/0016-name-other-tools-as-inspiration.md),
  [0017](./docs/decisions/0017-pull-requests-only.md)
- A rule that the owner verifies the running app and approves before a merge, with the dev server kept
  up on <http://127.0.0.1:5173> for the session. — [spec
  0013](./docs/specs/0013-owner-verifies-before-merge.md)
- The agent style skills now run at their strongest settings: `ultracave` (caveman at maximum
  compression, 2.5 kB instead of 4.7 kB) and ponytail at `ultra`. — [spec
  0014](./docs/specs/0014-stronger-agent-modes.md)

### Fixed

- Six tool interaction bugs reported from real use. — [spec 0012](./docs/specs/0012-tool-interaction-fixes.md)
  - The canvas now shows a cursor per tool: a crosshair for drawing, a move cursor, `ns-resize` for
    push/pull.
  - Three lines forming a triangle now close a face. The loop search rejected cycles of three points.
  - Axis pinning works on all three axes. The drawing plane is now lock-aware, so a `Z` lock reaches
    the third dimension instead of collapsing to a flat line or an empty rectangle.
  - Move previews a filled ghost of the geometry that follows the cursor, and `Esc` puts it back.
  - Push/pull extrudes by dragging. The distance was measured on the face plane, where it is always
    zero; it is now measured on a plane that contains the pull direction.
  - [Decision 0018](./docs/decisions/0018-axis-lock-semantics.md) records what a lock means per tool.

- Five more tool bugs reported from real use. — [spec 0015](./docs/specs/0015-tool-bug-round-two.md)
  - A closed polygon is now detected reliably. The loop search is breadth-first, so unrelated
    geometry cannot starve it and long polygons are no longer rejected, and clicks are far less
    likely to be pulled onto an inferred axis and break the loop.
  - The line tool follows the height axis by inference, without holding an arrow key.
  - Drawing stops once an edge closes a face, instead of chaining on from the closing point.
  - Picking a rectangle drawn inside another now selects the **inner** face. Coplanar faces tie on
    distance, so the smaller area decides, and every tool inherits it.
  - The selection marquee draws over the model, and a selected face shows its own outline instead of
    a black base edge drawn on top of it.
  - The drawing plane follows the face under the pointer even at a vertex or an edge of that face, and
    the status bar names the plane: `Ground`, `Face` or `Axis Z`.
  - A selected vertex is highlighted. Picking one already worked, but nothing was drawn for it, so the
    click looked like it had gone nowhere.

### Changed

- Axis inference is gated by screen distance rather than the 3D distance between the pointer ray and
  the axis line, which used to bind clicks the user aimed elsewhere. — [spec 0015](./docs/specs/0015-tool-bug-round-two.md)
- Module boundaries: `core` may now import `geometry`. `geometry` and `plugin-api` remain leaves.
  — [decision 0015](./docs/decisions/0015-core-depends-on-geometry.md)
- The repository is public, and the project describes itself as **inspired by** its main reference
  rather than a copy of it. — [spec 0011](./docs/specs/0011-repository-goes-public.md)
- `deploy-pages.yml` publishes on push to `main` instead of only on demand, now that Pages can be
  enabled. — [spec 0011](./docs/specs/0011-repository-goes-public.md)

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
