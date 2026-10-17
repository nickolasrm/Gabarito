# Gabarito

A web-based modeling tool — a SketchUp-like core that grows into a platform for woodworking,
lighting design, and house building.

*Gabarito* (Portuguese: *jig*, *template*): the jig you build against. A small, strict core that
domain features plug into rather than patch.

- Runs entirely in the browser. No server, no account, no upload. Served as static files.
- Modular by construction: the core knows nothing about woodworking, lighting, or houses.
- Programmed by agents, documented by default. See [`AGENTS.md`](./AGENTS.md).

## Status

**Pre-implementation.** This repository currently contains documentation and module boundaries
only. There is no runnable application, no build tooling, and no dependency manifest yet.

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
