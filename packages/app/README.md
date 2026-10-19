# app

`boot({ root })` initializes bundled Manifold WASM, creates the core store, and composes scene,
tools and React UI. This is the only package that knows every runtime module.

`input.ts` maps canvas pointer events and global shortcuts to tools. It leaves middle-button navigation to
scene and text-field input to the UI. `F` frames all geometry. Browser startup failures show a retry
message instead of leaving a blank viewport.

Development builds expose `window.__gabarito = { store, viewport, controller }` for browser tests.
Production builds omit it. Nothing in the application depends on that handle.

Run `npm run dev -- --port 5173 --strictPort` for human review. Automated browser tests use 5199.

Push/pull captures the primary pointer from press to release, including outside-canvas release.
Pointer cancel, lost capture and window blur abort it. Native click counts drive face/boundary/
connected selection. A release-generated click never starts a second push/pull operation.

Tape Measure also captures primary presses and suppresses native completion clicks. The controller
chooses click/click versus drag/release; app delivers both lifecycles without double commits. Blur
cancels tape measurements in either mode, including between clicks.

Alt down/up immediately updates `controller.setSnapping`, even without pointer movement. Pointer
modifier state also synchronizes before press/move/release/click. Blur restores snapping and clears
feedback, so missed key releases cannot leave snapping disabled. Explicit locks and typing survive.

Push/pull now uses the same click-versus-drag discriminator as tape. Each press captures its pointer;
a first stationary release leaves the operation armed, so uncaptured pointer movement previews the
next click. Native clicks stay suppressed to prevent duplicate commits. Blur also cancels an armed
push/pull between clicks, when there is no captured pointer.

Scale participates in captured primary gestures, click-mode movement and blur/pointer cancellation.
Native clicks belonging to captured gestures stay suppressed even if the tool changes before
release; the next intentional press starts normally. App unmount also disposes controller store
subscriptions before destroying the viewport.

Circle and Offset use ordinary click input. Window blur also cancels their pending operations.
App exposes Circle's creation segment setting through the controller; it adds no geometry state.

`component-placement.ts` routes native sidebar drags into transient world-space previews. Surface,
vertex, midpoint, ruler and ground placement use the viewport's existing picking; Alt bypasses
primitive snapping. Only a successful drop sends `place-component`. Leaving/cancelling a drag clears
the overlay. The sidebar invokes component creation, naming and context exit through UiApi; app
cancels tool previews when changing geometry scopes. Placement errors return to the sidebar.

UiApi routes library deletion/purge through core commands and cancels pending tool previews first.
Highlight components delegates to viewport presentation state. Sidebar errors remain inline.
