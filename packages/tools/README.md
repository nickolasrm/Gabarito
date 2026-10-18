# tools

`createController(store, view)` is a headless interaction state machine. No Three.js or scene import.
`types.ts` exports `ToolView`, `Controller`, `Status` and the six editing tools in `TOOLS`.
The seventh interaction feature, camera navigation, belongs to scene.

Public calls: `setTool`, `pointer`, `key`, `setTyped`, `submit`, `setUnit`, `cancel`, `status`,
`subscribe`. A view supplies visible picking, projection/rays and transient preview segments.

- Select supports Shift toggle and double-click connected geometry.
- Line chains edges until a planar face closes. Rectangle draws in the aimed face plane or ground.
- Move transforms selected shared vertices. Rotate accepts pivot/reference/angle or typed degrees.
- Push/pull accepts a signed normal distance or a pinned direction that leaves the face plane.
- Numeric entry is live while an operation is active. Enter commits; Escape cancels.
- Arrow Up pins Z, Right pins X, Left pins Y. Repeating the key releases it. Down pins negative Z.

Each edit emits one core command. Preview never mutates the document. Failures stay visible in status
and keep the operation active for correction. Tests: `npm test`; browser input: `npm run test:e2e`.
