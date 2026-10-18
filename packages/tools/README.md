# tools

`createController(store, view)` is a headless interaction state machine. No Three.js or scene import.
`types.ts` exports `ToolView`, `Controller`, `Status` and the six editing tools in `TOOLS`.
The seventh interaction feature, camera navigation, belongs to scene.

Public calls: `setTool`, `pointer`, `key`, `setTyped`, `submit`, `setUnit`, `cancel`, `status`,
`subscribe`, `press`, `release`, `leave`. A view supplies visible picking, projection/rays, transient
preview segments and `feedback(hit)` for the eligible hover/snap target. `pointer` accepts a native
click count; app routes held gestures through `press` and `release`.

- Select: single-click face; double-click face plus all boundary edges/vertices (including holes);
  triple-click connected geometry. Shift-single toggles; Shift-multiple adds.
- Line chains edges until a planar face closes. Rectangle draws in the aimed face plane or ground.
- Move transforms selected shared vertices. Rotate accepts pivot/reference/angle or typed degrees.
- Push/pull starts on primary press, previews while held, and commits once on release. Signed input
  and arrow locks remain available while held; Enter can commit early. Stationary clicks do nothing.
  Release always ends the gesture, including failures. Escape or pointer cancellation discards it.
- Numeric entry is live while an operation is active. Enter commits; Escape cancels.
- Arrow Up pins Z, Right pins X, Left pins Y. Repeating the key releases it. Down pins negative Z.

Each edit emits one core command. Preview never mutates the document. Failures stay visible in status
and keep click-based operations active for correction. Snap feedback is cleared on tool change,
leave and cancellation, and only shows a target when constraints actually permit it. Tests: `npm test`; browser input: `npm run test:e2e`.
