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

**Rewritten basic modeler.** Camera orbit/pan/zoom, rectangle, polygon line builder, selection,
move, push/pull and rotate. Typed dimensions, axis locks, visible-geometry snapping and undo/redo.
Drawings partition shared surfaces; closed-solid edits use bundled Manifold WASM.

Lengths are stored in millimetres. Input supports mm, cm, m, in and ft. While drawing, type values
and press Enter: rectangle `100,100`, line `10`, push/pull `10` (or `-10` to cut inward).
Arrow Up pins height/Z, Right width/X, Left depth/Y; press the same key again to release.
Middle mouse orbits; Shift+middle pans; wheel zooms. `F` frames the model.

No persistence yet: reload clears the document. No plugin host, lighting or woodworking tools.
The rewrite intentionally limits the toolbar to the requested basic tools; the previous circle,
ruler and annotation tools are deferred. See [spec 0021](docs/specs/0021-rewrite-modeler.md).

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
