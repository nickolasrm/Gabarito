import type { Plane, Vec3 } from "@gabarito/geometry";
import type { Command, DocumentState, EntityId, Settings } from "@gabarito/core";

export type ToolId =
  | "select"
  | "line"
  | "rectangle"
  | "circle"
  | "pushpull"
  | "move"
  | "rotate"
  | "ruler"
  | "measure";

export type SnapKind =
  | "endpoint"
  | "intersection"
  | "midpoint"
  | "edge"
  | "extension"
  | "guide"
  | "axis"
  | "face"
  | "free";

export interface SnapResult {
  point: Vec3;
  kind: SnapKind;
  label: string;
  /** The locked or inferred axis, when the snap is on one. */
  axis: { origin: Vec3; direction: Vec3 } | null;
  axisKey: "x" | "y" | "z" | null;
}

export interface AxisLockState {
  axisKey: "x" | "y" | "z";
  direction: Vec3;
  origin: Vec3;
}

export interface PickResult {
  entityId: EntityId;
  kind: "point" | "edge" | "face" | "guide" | "dimension";
  point: Vec3;
  distance: number;
}

export interface ToolPreview {
  segments: Array<{ a: Vec3; b: Vec3; color?: number }>;
  polygons: Array<{ points: Vec3[]; color?: number; opacity?: number }>;
  points: Array<{ position: Vec3; color?: number }>;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface ToolPointerEvent {
  screenX: number;
  screenY: number;
  /** The resolved point: snapped, axis-locked, or free. */
  world: Vec3;
  /** The point before inference, on the drawing plane. */
  raw: Vec3;
  snap: SnapResult;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  button: number;
}

export interface DrawingPlane {
  plane: Plane;
  normal: Vec3;
  /** In-plane basis used to build rectangles and circles. */
  u: Vec3;
  v: Vec3;
  /** Where this plane came from, shown in the status bar: "Ground", "Face", "Axis Z". */
  label: string;
}

export interface ToolContext {
  doc: DocumentState;
  settings: Settings;
  /** The resolved point of the most recent pointer move. */
  cursor: Vec3;
  axisLock: AxisLockState | null;
  dispatch(command: Command | Command[]): void;
  preview(preview: ToolPreview): void;
  pick(screenX: number, screenY: number): PickResult | null;
  project(point: Vec3): ProjectedPoint;
  planeAt(screenX: number, screenY: number): DrawingPlane;
  /** A plane through a point, facing the camera: used for screen-space overlays. */
  viewPlaneAt(point: Vec3): Plane;
  /** Direction from the camera into the scene. Tools that must build their own plane need it. */
  viewDirection(): Vec3;
  worldOnPlane(screenX: number, screenY: number, plane: Plane): Vec3 | null;
  pixelsPerWorldUnit(at: Vec3): number;
}

/**
 * A tool is a small state machine over `idle → first point → live → commit`.
 * It never mutates the document: it dispatches commands (invariant 6).
 * Typed values and axis locks arrive already resolved, per decision 0012.
 */
export interface Tool {
  readonly id: ToolId;
  readonly label: string;
  readonly shortcut: string;
  /** One line shown in the status bar while the tool is active. */
  readonly hint: string;
  /** CSS cursor while this tool is active. Drawing tools get a crosshair. */
  readonly cursor: string;
  /**
   * What an axis lock means to this tool:
   * `axis`  — the interaction point is pinned onto the locked axis (line, move, measure).
   * `plane` — the point stays free inside a plane that contains the locked axis
   *           (rectangle, circle, push/pull, rotate), which is what a 2D shape needs.
   */
  readonly lockMode?: "axis" | "plane";
  /** Example of the typed values the tool accepts, if any. */
  readonly numbers?: {
    kind: "length" | "angle";
    max: number;
    example: string;
    labels: string[];
  };
  activate?(ctx: ToolContext): void;
  deactivate?(ctx: ToolContext): void;
  cancel?(ctx: ToolContext): void;
  pointerDown?(event: ToolPointerEvent, ctx: ToolContext): void;
  pointerMove?(event: ToolPointerEvent, ctx: ToolContext): void;
  pointerUp?(event: ToolPointerEvent, ctx: ToolContext): void;
  /** Committed typed values, already parsed in the current unit. */
  commitNumbers?(values: number[], ctx: ToolContext): void;
  /** Live measurement shown in the status bar. */
  readout?(ctx: ToolContext): string | null;
  /** True while an operation is in progress, which is when typed input is accepted. */
  isActive?(ctx: ToolContext): boolean;
  /** Reference point for axis inference. */
  axisAnchor?(ctx: ToolContext): Vec3 | null;
  /** Called when the user presses `↓`, the "opposite direction" key. */
  invertDirection?(ctx: ToolContext): void;
}
