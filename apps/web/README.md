# apps/web

**Status:** implemented — static shell, deploys to GitHub Pages

## Responsibility

The deployable artifact. This is the only place that knows Gabarito is hosted on GitHub Pages.

- `index.html`, the single HTML entry, with `#root`.
- `src/main.ts`, which calls `boot({ root })`.
- The Vite root of the project (`vite.config.ts` points here), emitting a static `dist/`.

## Build

```bash
npm run dev      # development server
npm run build    # static bundle in dist/
npm run preview  # serve the built output
```

`base: "./"` keeps asset paths relative, so the same output works from a project Pages URL
(`/Gabarito/`), a user Pages URL, or a plain static file server
([decision 0001](../../docs/decisions/0001-static-hosting-github-pages.md)).

## Deploy

`.github/workflows/deploy.yml` typechecks, tests, builds, adds `.nojekyll`, and publishes `dist`.
There is no server, no environment variable and no secret anywhere in the pipeline.

## Owns

Deployment concerns only: build config, HTML shell, asset base, hosting workarounds.

## Must not

- Contain domain logic, UI components, or geometry.
- Be imported by anything; it sits at the top of the dependency graph.
