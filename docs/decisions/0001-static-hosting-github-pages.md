---
id: 0001
title: Static hosting on GitHub Pages, no server
status: accepted
date: 2026-10-17
tags: [hosting, deployment, constraints, offline]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0001 — Static hosting on GitHub Pages, no server

## Context

Gabarito is a 3D modeling tool with no current users and no funding story. It needs somewhere to
live that costs nothing and needs no operational attention. The project owner explicitly requires
it to run on GitHub Pages, which serves static files only: no compute, no environment variables, no
request handlers, no server-side rendering.

This removes an entire class of design options before any code exists, which is exactly why it is
record 0001: everything else has to be consistent with it.

## Decision

Gabarito ships as a **static single-page application**. The build output is a folder of files. There
is no backend, no API, no database, and no secret in the repository. Every capability is implemented
client-side, and anything that would need a server is either dropped or moved to an optional,
user-supplied-key integration.

Concretely:

- The Vite build targets relative-safe asset paths with `base: './'` so the same output works from a
  project Pages URL (`/Gabarito/`), a user Pages URL, or a local file server.
- Deploying Pages involves no server config and no secrets: a workflow builds and publishes the
  output folder, or a branch serves it directly.
- `.nojekyll` is present so Jekyll does not silently drop asset directories whose names begin with
  an underscore.
- Deep links are handled without server rewrites. Either the SPA uses hash routing, or the build
  emits a `404.html` copy of `index.html` so Pages falls back to the app. The choice is deferred to
  the routing spec; the constraint is recorded here.
- Persistence is local-first ([0007](./0007-local-first-persistence.md)) because there is nowhere
  else to persist.
- Any future AI or cloud feature must run from the client against an endpoint the *user* configures
  with their own credentials. It may never become a core editing dependency.

## Consequences

**Good:** zero hosting cost and zero operations; no secrets to leak; no server to patch; the app
works offline and can be mirrored anywhere; contribution needs no infrastructure; distribution is a
URL.

**Bad:** no shared documents, collaboration, or server-side compute without a separate decision and
some external service; heavy geometry work must fit in a browser tab; the project file format and
import/export are the only data-exchange surface; a purely client-side product cannot do
authentication or billing itself.

**Neutral:** deployment is a build artifact, so caching and asset hashing matter more than usual;
the app must tolerate being loaded from a subpath.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Small server (Node/Cloudflare Worker) for storage and geometry | Costs money and attention, adds secrets and uptime concerns, and contradicts the stated requirement. |
| Static host with an optional serverless backend later | Still on the table as an *optional* plugin behind a user-configured endpoint, but never a core dependency. |
| Desktop app (Electron/Tauri) | Solves hosting but loses the "open a URL" property and adds release engineering. |
| SSR framework on a managed platform | The very thing being ruled out; SSR with no server is not possible. |

## Links

- Related: [0007](./0007-local-first-persistence.md) (local-first follows from this),
  [0004](./0004-repository-layout.md) (hosting quirks stay in `apps/web`)
- Specs: `docs/specs/0001-bootstrap-repository-structure.md`
