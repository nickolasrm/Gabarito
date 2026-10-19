# Gabarito

A web-based modeling tool — a SketchUp-like core that grows into a platform for woodworking,
lighting design, and house building.

*Gabarito* (Portuguese: *jig*, *template*): the jig you build against. A small, strict core that
domain features plug into rather than patch.

- Runs entirely in the browser. No server, no account, no upload. Served as static files.
- Modular by construction: the core knows nothing about woodworking, lighting, or houses.
- Programmed by agents, documented by default. See [`AGENTS.md`](./AGENTS.md).

Gabarito is inspired by the interaction model of SketchUp and other face-based modelers, and by what
their users complain about. It is an independent project: not affiliated with, endorsed by, or a
continuation of anything it draws on, and not a replacement for any of it.

## Status

**Rewritten basic modeler.** Camera orbit/pan/zoom, rectangle, circle, face offset, polygon line builder, selection,
move, scale, push/pull, rotate, tape measure and linked components. Typed dimensions, axis locks, visible-geometry snapping and undo/redo.
Drawings partition shared surfaces; closed-solid edits use bundled Manifold WASM.

Lengths are stored in millimetres. Input supports mm, cm, m, in and ft. While drawing, type values
and press Enter: rectangle `100,100`, line `10`. For push/pull, hold a face, drag, and release; type `10` while holding for an exact
distance (or `-10` to cut inward).
Arrow Up pins height/Z, Right width/X, Left depth/Y; press the same key again to release.
Middle mouse orbits; Shift+middle pans; wheel zooms. `F` frames the model.
Scale (`S`) draws a bounding box around selected geometry. Drag face or edge handles to stretch,
corner handles to scale proportionally, or click a handle and type a positive factor such as `2`.
Circle (`C`) uses a center and radius; type `10` for a 10-unit radius. Circle segments default to 24.
Offset (`O`) uses a face and inward edge distance; type `10` for a 10-unit border on every side.
Both partition parent faces, keeping inner regions available for further modeling.
Select geometry and use Make component in the Components sidebar. Name the definition, drag its
grip into the viewport to place a linked instance, and double-click an instance to edit it. Edits
update every instance; outside drawings stay separate. Exit component, idle Escape or an outside
double-click returns outward. The sidebar includes component previews, highlighting, definition
deletion and Purge unused. Deleting a selected scene instance leaves its definition available.
Modeling tools use a crosshair; visible vertex/edge targets get labeled snap markers. Select a face
with one click, its boundary with two clicks, or connected geometry with three clicks.

No persistence yet: reload clears the document. No plugin host, lighting or woodworking tools.
The toolbar covers basic modeling and construction rulers; annotation tools remain deferred. See [spec 0021](docs/specs/0021-rewrite-modeler.md).

```bash
npm ci
npm run dev      # http://localhost:5173
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## Start here

| You are | Go to |
|---|---|
| An agent starting work | [`AGENTS.md`](./AGENTS.md) |
| Looking for a past decision | [`docs/decisions/README.md`](./docs/decisions/README.md) |
| Planning a change | [`docs/specs/TEMPLATE.md`](./docs/specs/TEMPLATE.md) |
| Curious about the architecture | [`docs/architecture/overview.md`](./docs/architecture/overview.md) |
| Wondering what changed | [`CHANGELOG.md`](./CHANGELOG.md) |

## Layout

```
apps/web            the deployable static site shell
packages/*          the libraries it composes
docs/               specs, decision records, architecture, guides
```
