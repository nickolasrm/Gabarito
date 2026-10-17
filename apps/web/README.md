# apps/web

**Status:** empty — no code yet ([spec 0002](../../docs/specs/0002-monorepo-tooling-bootstrap.md))

## Responsibility

The deployable artifact. This is the only place that knows Gabarito is hosted on GitHub Pages.

- The Vite entry point and `index.html` shell.
- Base-path handling for a project Pages URL (`/Gabarito/`).
- The deep-link fallback mechanism (hash routing, or a generated `404.html`).
- `.nojekyll` propagation into the build output.
- The composition call into `@gabarito/app`.

## Owns

Deployment concerns only: build config, HTML shell, asset base, hosting workarounds.

## Must not

- Contain domain logic, UI components, or geometry.
- Be imported by anything. This package sits at the top of the dependency graph.

## Depends on

`@gabarito/app`.

## Deploy

Static output only. No server, no environment variables, no secrets
([decision 0001](../../docs/decisions/0001-static-hosting-github-pages.md)).

## Read next

[`docs/decisions/0001-static-hosting-github-pages.md`](../../docs/decisions/0001-static-hosting-github-pages.md)
