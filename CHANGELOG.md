# Changelog

## Circle and inward Offset — 2026-10-18

- Circle (`C`) uses a center and radius, typed units, shared face references and a frozen support
  plane. It creates ordinary edges/faces with 24 segments by default; a creation setting accepts
  3–256 segments. Preview and commit share the same points and partition existing surfaces.
- Offset (`O`) uses an exact perpendicular edge distance to inset face material through the bundled
  kernel. Concave splits and existing holes are preserved. One atomic command adds shared inner
  boundaries while retaining the parent surface; collapse and invalid input leave it unchanged.
- Both tools support cancellation and one-step history. Specs: [0036](docs/specs/0036-circle-tool.md),
  [0037](docs/specs/0037-offset-tool.md).

## Routine workflow authorization — 2026-10-18

- `AGENTS.md` records standing authorization for server operations, tests, staging/committing, branch
  publication, PR creation/updates and CI checks. In-scope implementation specs need no redundant
  confirmation. Every merge still requires fresh explicit owner approval and passing checks.
- Spec: [0035](docs/specs/0035-standing-workflow-authorization.md).

## Scale selection — 2026-10-18

- Added Scale (`S`) with a tight bounding box and draggable corner, edge and face handles. Face
  handles stretch one dimension, edges two independently, and corners scale proportionally about
  their opposite anchor. Flat and line selections retain their actual dimensions.
- Drag/release, click/move/click and positive typed factors preview before one undoable commit.
  Hidden handles cannot be grabbed; overlays follow navigation and clear on tool changes.
  Cancellation, selection/history refresh and atomic topology validation protect pending edits.
- Spec: [0034](docs/specs/0034-scale-selection.md).

## Rotation face-reference hints — 2026-10-18

- Rotate shares face midpoint alignment, center-intersection and diagonal inference while choosing
  its anchor, zero direction and angle. Named markers and transient lines identify the snapped
  reference. Explicit geometry wins, Alt bypasses inference, and the frozen rotation plane stays fixed.
- Spec: [0033](docs/specs/0033-rotate-face-reference-hints.md).

## Rotation anchor and orientation — 2026-10-18

- Rotate uses anchor A and zero-angle point B to infer its supporting face or boundary plane, then
  freezes that plane. Geometry stays at zero rotation until B is chosen; movement afterward shows
  signed degrees and reference rays before a final click commits.
- On-plane snapped points stay exact. Explicit axes, Alt bypass, typed degrees, cancellation and
  one-step history remain available. Rotate guidance and the plane indicator describe the new flow.
- Spec: [0032](docs/specs/0032-rotate-anchor-orientation.md).

## Constrained reference snapping — 2026-10-18

- Push/Pull aligns to an explicitly hovered face plane even when the free depth is far from it.
  The zero-level guard still prevents accidental resets to the starting plane.
- Axis-pinned Move now shares the reference resolver: vertex, edge and ruler coordinates or a face
  plane determine the pinned coordinate while the other two stay fixed. Feedback shows the target,
  connector and level. Alt bypass, typed dimensions and history keep their existing behavior.
- Spec: [0031](docs/specs/0031-constrained-reference-snapping.md).

## Tool inference and input lifecycle fixes — 2026-10-18

- Tape Measure now uses shared face midpoint, diagonal and intersection snapping, with inference
  lines and named feedback. It resolves the hovered face's plane when measuring across surfaces,
  and shares Line's automatic axis inference over empty space. Alt still bypasses inference.
- Push/Pull supports both click/move/click and hold/drag/release without a mode switch. Both preserve
  snapping, numeric input and one-step undo/redo; cancellation also works between clicks.
- Axis pins, their signs and cached plane labels reset after completion, Escape and tool changes. Line segments reset
  their pins individually while retaining the chain; active explicit pins override face inference.
- Specs: [0028](docs/specs/0028-tape-measure-inference.md),
  [0029](docs/specs/0029-dual-pushpull-gestures.md), [0030](docs/specs/0030-reset-axis-pins.md).

## Measurement snapping completion — 2026-10-18

- Midpoints keep their source-edge identity even at coincident ruler intersections. Tape previews
  show the prospective infinite dashed ruler; completion alone creates its entity.
- Rectangle proportions now snap actual dimensions. Face midpoint alignments and diagonals provide
  exact drawing references with visible inference lines, including rotated faces and face centers.
- Hold Alt to bypass snapping; release restores it immediately. Support planes, explicit axis locks
  and typed dimensions remain active. Blur resets the modifier state.
- Push/pull matches visible vertex/edge levels and nearby crossing face planes. Distant starting-level
  edges cannot reset a free extrusion. Reference targets and connecting lines remain visible.
- Spec: [0027](docs/specs/0027-complete-measurement-snapping.md).

## Measurements and construction references — 2026-10-18

- Added Tape Measure (`T`) with click/click and drag/release input, live cursor distances in selected
  units, and undoable infinite rulers. Edge sources create parallel rulers; face/vertex sources
  follow the measured direction through the destination.
- User rulers support selection, deletion and transforms without becoming model geometry. Axes
  extend in both directions as undeletable snap references, with a shared virtual origin vertex.
- Added exact midpoint snapping and labels, visible face-boundary midpoint hints, and virtual
  ruler intersections. References use the same camera-depth and occlusion rules as geometry.
- Rectangle previews show temporary diagonals and labels for squares and integer aspect ratios;
  actual dimensions and document edges remain unchanged.
- Spec: [0026](docs/specs/0026-measurements-and-references.md).

## Coplanar divider deletion — 2026-10-18

- Deleting a shared coplanar edge merges its faces, preserving the parent surface and other holes.
- Unselected sketch edges remain. Explicit face/vertex and perimeter/crease deletion retain their
  removal behavior; mixed deletions never recreate a selected perimeter.
- Added core deletion/history regressions and a filled vertical recess browser regression.
- Spec: [0025](docs/specs/0025-erase-coplanar-dividers.md).

## Rectangle opening repair — 2026-10-18

- Rectangles infer their plane and edge alignment from snapped boundary targets, including vertical
  and rotated openings. Preview and commit share four planar corners; the active plane is shown.
- Explicitly tracing an opening restores one face without a diagonal document edge. Deleted regions
  track split boundary loops, so unrelated drawing continues to leave holes and deletions intact.
- Added vertical recess/fill browser coverage and headless plane/restoration/history regressions.
- Spec: [0024](docs/specs/0024-fill-openings-with-rectangle.md).

## Modeling input and feedback — 2026-10-18

- Modeling tools use precise crosshair cursors. Vertex and edge targets show labeled markers at
  their actual snap positions; hovered faces are tinted without changing selection.
- Push/pull now uses hold, drag and release, with pointer capture, cancellation and exact typed
  dimensions while held. Release makes one undoable edit; stationary clicks are no-ops.
- Face selection now expands in three stages: face, face boundary, connected geometry. Boundary
  selection includes hole loops and preserves Shift selection behavior.
- Added controller and browser regressions; updated earlier push/pull tests to the new gesture.
- Spec: [0023](docs/specs/0023-modeling-input-feedback.md).

## Raised-sheet push/pull fix — 2026-10-18

- Fixed pushing or pulling a face drawn on top of an already raised sheet. The first extrusion
  legitimately leaves an open surface, which the former flat-sheet check refused on the next edit.
- Coplanar swept walls now merge or cancel, allowing extension, retraction and return to flat without
  overlapping faces. Reused shared-edge splitting preserves adjacent boundaries.
- Added eight headless and four browser regressions, including mouse/numeric input in both
  directions, repeated edits, rotated sheets, perimeter/winding checks and undo/redo.
- Spec: [0022](docs/specs/0022-open-sheet-pushpull.md).

## Topology rewrite — 2026-10-17

- Replaced the modeler runtime with shared vertices/edges and planar face partitions. Nested drawings
  cut the parent surface before extrusion. General polygon/rotated-solid push/pull uses Manifold.
- Rebuilt the six basic editing tools plus camera navigation, numeric input, axis locks and undo/redo.
- Replaced relative-depth picking with forward-depth and per-candidate occlusion checks.
- Added mandatory skill loading to AGENTS.md and behavioral regressions for geometry and browser input.
- Scoped the toolbar to the requested basics; circle, guides and annotations are deferred. No saved
  document migration is needed because persistence had not shipped.
- Spec: [0021](docs/specs/0021-rewrite-modeler.md); decision: [0027](docs/decisions/0027-topology-rewrite.md).


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

- Push/pull now **cuts**: pushing a face into a solid removes the material, and pulling out adds it.
  Shells are computed from face connectivity rather than stored; the cut is a `manifold-3d`
  subtraction of two axis-aligned boxes, converted back to entities with topology and winding taken
  from the kernel mesh. The cut is refused with a message when the solid is not an axis-aligned box of
  rectangles, or before the WASM kernel has loaded. Extrusion still works everywhere it did.
  — [spec 0016](./docs/specs/0016-cut-holes-with-push-pull.md),
  [decision 0022](./docs/decisions/0022-cuts-run-on-manifold.md)
- An opening's border is **one face with a hole**, the way this product's inspiration keeps it, not
  four rectangle strips with seams: `FaceEntity` gained an optional `holes` (loops of point ids),
  rendering triangulates the contour with its holes, picking misses a hit inside a hole, and the
  strip arithmetic the old model forced (`conformRects`, `rect.subtract`) is gone. Pushing a face
  that has holes is refused with a message.
  — [spec 0017](./docs/specs/0017-faces-hold-holes.md),
  [decision 0023](./docs/decisions/0023-faces-hold-holes.md)
- **Cuts land on any rectilinear closed solid, not just boxes**: the second cut enters the first
  cut's cavity — deepen a recess, window a cavity wall, cut a rectangle drawn on a cut solid. The
  shell feeds the kernel as a mesh (drawn-on markings dropped from the mesh input), the cut against
  extrude is decided by measuring the sweep's overlap with the solid, and the box-only gate is gone.
  — [spec 0018](./docs/specs/0018-second-cut.md),
  [decision 0024](./docs/decisions/0024-cuts-enter-any-rectilinear-solid.md)
- **The sweep follows the drag, and pull is a union**: push and pull can no longer swap sides on a
  face wound the other way (the sweep lands where the preview shows), and pulling material out goes
  through the kernel as a union — pulling a cavity's floor to the rim fills the cavity exactly, with
  the walls trimmed, instead of stacking a prism inside it. The extrusion at the no-solid case
  reuses existing points instead of silently doing nothing; refusals replace silence.
  — [spec 0019](./docs/specs/0019-pull-is-a-union.md),
  [decision 0025](./docs/decisions/0025-pull-is-a-union.md)
- **No limit on holes**: an opening's face holds every hole it gets — openings nest and repeat
  without end, and several coplanar regions (two tunnels' walls) stay separate faces. The kernel
  triangulator's winding rule (outer counter-clockwise, holes clockwise in the projection) is
  normalised and its refusal made structural. Five through holes, three through one face, leave one
  face with five holes and a solid of genus five, exact.
  — [spec 0020](./docs/specs/0020-no-hole-limit.md),
  [decision 0026](./docs/decisions/0026-face-holds-every-hole.md)

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
  - Vertex snapping is measured against the pointer ray, so the line tool can be pointed at a vertex
    that is not on the plane under the cursor.
  - An edge that closes several loops now creates a face for each of them, not only the first.
  - The drawing plane follows what the pointer is aiming at: a vertex or an edge decides it even with
    a face underneath, and the face decides only when the face itself is the target.
  - The drawing plane always contains the line from the anchor to the pointer, so a rectangle can reach
    any vertex instead of collapsing to a line and refusing to be created. The second axis is the edge
    direction about 45 degrees to that line, which keeps both extents real.
  - A rectangle drawn between two bare edges stays in the plane those edges define. With no face under
    the pointer the plane fell back to the ground while keeping the anchor's height, so the preview was
    a width/depth rectangle floating at that height. The plane now follows the geometry under the
    pointer while no axis is pinned.

- Decision [0021](./docs/decisions/0021-straight-cuts-by-face-surgery.md): straight cuts are **face
  surgery on axis-aligned rectangles**, with no CSG library and no runtime dependency, superseding
  decision 0019. The adopted library produced T-junctions on the first real cut — 16 edges used once,
  which the closedness check rejects — and the recorded fallback, `manifold-3d`, then failed on its input
  mesh rather than on the maths. The operation push/pull needs is one axis-aligned box minus another, so
  a kernel was four hundred kilobytes and a WASM bridge for rectangle arithmetic. Plan in
  [spec 0016](./docs/specs/0016-cut-holes-with-push-pull.md), left `proposed`.

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

## 2026-10-18 — Linked component contexts

- Added named shared component definitions and independently transformed linked instances.
- Selections become components without cutting or welding surrounding contexts. Double-click opens
  their geometry; edits propagate to every linked instance. Exit or idle Escape returns outward.
- Added a Components sidebar with naming and drag-to-place previews for linked instances.
- Kept snapping across contexts and existing Move/Rotate/Scale behavior for atomic instances.
- Added headless and browser regressions for isolation, shared boundaries, linked topology, nested
  contexts, transformed edits, cycle rejection, history, naming and placement.
- Spec: [0038](docs/specs/0038-linked-components.md); decision: [0028](docs/decisions/0028-component-contexts.md).

## 2026-10-19 — Component library and context feedback

- Added explicit library deletion of definitions and all their linked/nested instances, with Undo.
  Scene Delete retains its single-instance behavior.
- Added scene-reachability detection, Unused badges and undoable Purge unused.
- Added live isometric library thumbnails and a Highlight components view toggle.
- Double-clicking outside a component exits one edit level; nested geometry now highlights with its parent.
- Added core, thumbnail and browser regressions for these owner-reported cases.
- Spec: [0039](docs/specs/0039-component-library-and-context-feedback.md).
