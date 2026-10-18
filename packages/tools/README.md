# tools

`createController(store, view)` is a headless interaction state machine. No Three.js or scene import.
`types.ts` exports `ToolView`, `Controller`, `Status` and the seven editing and measuring tools in `TOOLS`.
Camera navigation belongs to scene.

Public calls: `setTool`, `pointer`, `key`, `setTyped`, `submit`, `setUnit`, `cancel`, `status`,
`subscribe`, `press`, `release`, `leave`, `setSnapping`. A view supplies visible picking, projection/rays, transient
preview segments and `feedback(hit)` for the eligible hover/snap target. `pointer` accepts a native
click count; app routes held gestures through `press` and `release`.

- Select: single-click face; double-click face plus all boundary edges/vertices (including holes);
  triple-click connected geometry. Shift-single toggles; Shift-multiple adds.
- Line chains edges until a planar face closes. Rectangle infers its plane from the aimed face or boundary, including rotated openings.
- Move transforms selected shared vertices. Rotate accepts pivot/reference/angle or typed degrees.
- Push/pull supports click/move/click and press/drag/release together. A stationary first release
  arms click mode without editing; a drag release or second click commits once. Signed input and
  arrow locks work in both modes; Enter can commit early. Zero-depth completion is a no-op.
  Escape, tool changes, blur and pointer cancellation discard pending operations.
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

`proportions.ts` snaps rectangle endpoints to exact squares/integer aspect ratios within eight
screen pixels. Visible explicit geometry wins; face layout references win over approximate ratios,
while an already exact ratio remains exact. Preview and commit share the result; typed dimensions
override proximity. The diagonal stays transient. Tape previews include the prospective infinite
ruler as well as the finite measurement segment; neither writes document state before completion.

`face-snap.ts` infers perpendicular alignment lines from visible boundary midpoints and diagonals
of quadrilateral faces, including rotated planes and collinear boundary splits. Holes exclude false
material targets. Intersections can lock both coordinates. Feedback includes the named source and
reference line. `midpointEdge` resolves source provenance, so virtual midpoint hits still produce
edge-parallel rulers. Hits carry `sourceEdge` when needed.

`extrusion-snap.ts` matches a hovered vertex/edge elevation or a nearby crossing face plane along
the existing extrusion axis. Face and zero-level snaps require proximity; the active face and
parallel face planes are excluded. Feedback names the level and connects it to the extrusion axis.

`ToolView.visible(point)` applies scene occlusion to inferred reference points. `setSnapping(false)`
bypasses feature picking, face/proportion/automatic-axis inference and push/pull references; it
preserves the support plane, explicit locks and typed dimensions. `Status.snapping` exposes this
state. App maps Alt down/up to this method and resets it on blur.

Tape participates in the same face midpoint/diagonal/intersection resolver as Line and Rectangle,
using the hovered target face's plane when measuring across different surfaces. Cursor labels show
the distance plus inference name; finite inference lines accompany the prospective infinite ruler.
Automatic axis inference also applies to tape over empty space. Explicit pins take priority over
face inference, while explicit geometry priority and Alt bypass remain shared.

The gesture discriminator is shared by tape and push/pull. Completion and cancellation clear both
axis and sign. Each committed line segment clears its own pin while retaining the polygon chain;
this prevents the next segment or tool use from inheriting an earlier lock.
