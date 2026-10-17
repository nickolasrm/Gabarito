# Invariants

Properties that must never be broken. If a change would break one, stop and write an ADR first.

## Product

1. **Static hosting only.** The build output runs from a plain file host. No server, no API, no
   runtime secrets, no network dependency for core editing.
2. **Offline-capable.** Loading the app, editing, and saving work with no network.
3. **Local-first.** User documents live on the user's device. Nothing is uploaded implicitly.
4. **Portable documents.** The project file format is versioned, self-describing, and readable
   by any future version that claims to support it.

## Architecture

5. **One source of truth.** The `core` document store is the only mutable application state.
   Renderers, tools, and UI derive from it and never hold authoritative state.
6. **Commands are the only mutation path.** Every document change is a serialisable command with
   an inverse, so undo/redo and future replay/collaboration stay possible.
7. **Headless core.** `core` and `geometry` run in plain Node with no DOM, WebGL, or browser
   globals. Their test suites never need a browser.
8. **Core is domain-agnostic.** No woodworking, lighting, or architecture concept may enter
   `core`, `geometry`, `scene`, or `tools`. Domain concepts live in plugins.
9. **Dependencies point inward.** `plugin-api` and `core` import nothing from their consumers.
10. **Plugins are removable.** Disabling any plugin leaves a valid, loadable document; plugin
    data is namespaced and forward-compatible.
11. **Deterministic geometry.** Identical input produces identical output. No wall-clock, no
    iteration-order dependence, no floating-point luck in tests.

## Process

12. **Every change has a spec.** No commit lands without one in `docs/specs/`.
13. **Decisions are append-only.** Accepted records are never edited — only superseded.
14. **Indexes are part of the change.** A new file that is missing from its index table is a bug.

## Conventions

15. **Units.** Internal length unit is millimetres; internal angle unit is radians. Display units
    are a presentation concern.
16. **Orientation.** Internal world is Z-up, right-handed, matching architectural convention. The
    renderer adapts at its boundary; the document never stores render-space coordinates.
17. **IDs.** Entity IDs are opaque strings, stable across saves. Never reuse an ID.
