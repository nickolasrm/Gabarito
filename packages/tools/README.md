# tools

`createController(store, view)` is a headless interaction state machine. No Three.js or scene import.
`types.ts` exports `ToolView`, `Controller`, `Status` and the seven editing and measuring tools in `TOOLS`.
Camera navigation, belongs to scene.

Public calls: `setTool`, `pointer`, `key`, `setTyped`, `submit`, `setUnit`, `cancel`, `status`,
`subscribe`, `press`, `release`, `leave`. A view supplies visible picking, projection/rays, transient
preview segments and `feedback(hit)` for the eligible hover/snap target. `pointer` accepts a native
click count; app routes held gestures through `press` and `release`.

- Select: single-click face; double-click face plus all boundary edges/vertices (including holes);
  triple-click connected geometry. Shift-single toggles; Shift-multiple adds.
- Line chains edges until a planar face closes. Rectangle infers its plane from the aimed face or boundary, including rotated openings.
- Move transforms selected shared vertices. Rotate accepts pivot/reference/angle or typed degrees.
- Push/pull starts on primary press, previews while held, and commits once on release. Signed input
  and arrow locks remain available while held; Enter can commit early. Stationary clicks do nothing.
  Release always ends the gesture, including failures. Escape or pointer cancellation discards it.
- Numeric entry is live while an operation is active. Enter commits; Escape cancels.
- Arrow Up pins Z, Right pins X, Left pins Y. Repeating the key releases it. Down pins negative Z.

Each edit emits one core command. Preview never mutates the document. Failures stay visible in status
and keep click-based operations active for correction. Snap feedback is cleared on tool change,
leave and cancellation, and only shows a target when constraints actually permit it. Tests: `npm test`; browser input: `npm run test:e2e`.

`drawing-plane.ts` infers the supporting plane from incident face loops/edges and both snapped
corners. Its basis follows supporting edges, and the status bar names the active plane. Explicit
axis locks freeze inference. With no support, the first point anchors a plane parallel to ground;
o unsupported off-plane target is shown as snapped. Preview and commit share the same four corners.
Rectangle commands include `fillLoop`, allowing an explicitly retraced opening to regain a face.

Tape Measure (`T`) supports click/click and press/drag/release. It measures between actual hovered
3D positions, falling back to the origin's support plane over empty space. The cursor label uses
selected display units. Completion emits one guide command through the destination: parallel to
a source edge/ruler, or along the measured direction for face/vertex origins. Zero-length completion
is a no-op. Click mode needs a second press/release; drag mode finishes after a three-pixel movement.
`cursorHint(text, x, y)` displays transient measurements/proportions without mutating selection.
`preview(segments, rulers?)` also supports infinite ruler previews during transforms.

`proportions.ts` recognizes squares and integer aspect ratios, in either orientation, within 0.02
of the ratio. The rectangle preview adds a diagonal and cursor hint only; actual corner positions
and typed dimensions remain unchanged. Midpoints, virtual intersections, origin and rulers share
the ordinary visible snap-hit contract (`snap` distinguishes named point references).
