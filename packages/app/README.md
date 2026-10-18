# app

`boot({ root })` initializes bundled Manifold WASM, creates the core store, and composes scene,
tools and React UI. This is the only package that knows every runtime module.

App maps canvas pointer events and global shortcuts to tools. It leaves middle-button navigation to
scene and text-field input to the UI. `F` frames all geometry. Browser startup failures show a retry
message instead of leaving a blank viewport.

Development builds expose `window.__gabarito = { store, viewport, controller }` for browser tests.
Production builds omit it. Nothing in the application depends on that handle.

Run `npm run dev -- --port 5173 --strictPort` for human review. Automated browser tests use 5199.
