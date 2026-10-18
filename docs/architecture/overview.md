# Architecture overview

One page. Read [`invariants.md`](./invariants.md) next, and
[`module-boundaries.md`](./module-boundaries.md) before writing any import.

## Shape

Gabarito is a **static single-page application**. The browser is the entire runtime: no server,
no API, no background compute. Everything ships as files from GitHub Pages.

```
   apps/web                    deployment shell: Vite entry, routing, Pages hosting
       │ composes
   ┌───┴─────────────────────────────────────────────────────────┐
   │  packages/app     composition root, plugin registry, boot   │
   └──┬──────────────┬──────────────────┬────────────────────────┘
      │              │                  │
  packages/ui   packages/tools   packages/plugin-host
      │              │                  │
      └──────┬───────┴──────────────────┘
             │
      packages/scene ──────► Three.js (WebGL)
             │
      packages/geometry     pure math: no DOM, no WebGL, no browser
             │
      packages/core         document, entities, commands, undo, units
             │
      packages/persistence  IndexedDB, File System Access API, project files
```

`packages/plugin-api` holds the versioned contracts a plugin implements. `app` and every feature
package import it; it imports nothing from them.

## Runtime model

1. `boot` creates the document store, the viewport, and the tool controller, then mounts the UI.
2. `scene` subscribes to the document and keeps a derived Three.js scene in sync.
3. `tools` converts pointer and keyboard input into **commands**.
4. `core` applies the command, validates the transaction, pushes a snapshot undo entry, and notifies subscribers.
5. `ui` renders React chrome from the same store; the viewport is a canvas React never renders into.
6. `persistence` snapshots the document to local storage or to a `.gabarito` project file. *(Not built
   yet.)*

React never owns geometry. The viewport never owns state. Tools never touch Three.js objects — the
viewport reaches them through the `ToolView` interface.

## Modules

| Package | Owns | Depends on | Status |
|---|---|---|---|
| `core` | document, entities, selection, commands, undo, units, events | geometry | built |
| `geometry` | vectors, planes, planes, planar arrangements, triangulation, solid sweeps | — | built |
| `scene` | WebGL renderer, camera, grid, picking, materials, highlighting | core, geometry | built |
| `tools` | interaction state machines: select, line, rectangle, push/pull, move, rotate… | core, geometry | built |
| `ui` | React shell: toolbar, units, dimensions, status and model counts | core, plugin-api | built |
| `persistence` | IndexedDB/OPFS storage, project file I/O, import/export | core, geometry | planned |
| `plugin-api` | the versioned contracts plugins implement | — | planned |
| `plugin-host` | manifest, registration, activation lifecycle, capability checks | plugin-api | planned |
| `app` | composition root, wiring, keymaps, boot | all of the above | built |
| `features/*` | domain plugins | plugin-api only | planned |

## Current modeling implementation

Drawing splits segments and walks bounded planar regions, so nested drawings partition a face.
Closed-shell push/pull goes through Manifold. Open sheets use selected-patch extrusion with coplanar wall merging and cancellation.
Snapshot transactions validate before publishing and provide undo/redo. See
[0027](../decisions/0027-topology-rewrite.md) and the owning package READMEs for implementation.
The old implementation's specs remain historical; spec 0021 describes the replacement.

## Why this shape

The domain features are unknown today, so the core is deliberately a *modeler* and not a
*woodworking tool*. Anything that knows about board feet, IES light profiles, or wall assemblies
lives behind the plugin contract — see
[decision 0005](../decisions/0005-plugin-architecture.md) and the feature specs in
[`../features/`](../features/README.md).
