import { poly as polyOps, vec3 } from "@gabarito/geometry";
import type { Plane, Ray, Vec3 } from "@gabarito/geometry";
import {
  facePositions,
  parseAngle,
  parseLength,
  unitSuffix,
  type Command,
  type Store,
} from "@gabarito/core";
import { axisForArrow } from "./axis-lock";
import { resolveSnap } from "./inference";
import { axisPlaneBasis, axisPlaneNormal } from "./planes";
import { createTools } from "./tools";
import type {
  AxisLockState,
  DrawingPlane,
  PickResult,
  SnapResult,
  Tool,
  ToolContext,
  ToolId,
  ToolPointerEvent,
  ToolPreview,
} from "./types";

/**
 * The part of the viewport the tools need. Declared here so `tools` never imports
 * `scene` or three.js; `app` passes the viewport straight in, matched structurally
 * (module boundaries).
 */
export interface ViewportAdapter {
  raycast(screenX: number, screenY: number): PickResult | null;
  /** The pointer ray in world space. */
  rayAt(screenX: number, screenY: number): Ray;
  raycastPlane(screenX: number, screenY: number, plane: Plane): Vec3 | null;
  worldToScreen(point: Vec3): { x: number; y: number; visible: boolean };
  pixelsPerWorldUnit(at: Vec3): number;
  /** Direction from the camera into the scene, used to build camera-facing planes. */
  viewDirection(): Vec3;
}

export interface PointerState {
  screenX: number;
  screenY: number;
  button: number;
  buttons: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface ToolStatus {
  toolId: ToolId;
  label: string;
  hint: string;
  numberHint: string | null;
  typed: string;
  readout: string | null;
  snapLabel: string;
  axisKey: "x" | "y" | "z" | null;
  unit: string;
  suffix: string;
  active: boolean;
}

export interface SnapIndicator {
  position: Vec3;
  kind: string;
  axis: { origin: Vec3; direction: Vec3 } | null;
  axisKey: "x" | "y" | "z" | null;
}

export const EMPTY_PREVIEW: ToolPreview = { segments: [], polygons: [], points: [] };

const GROUND_PLANE: Plane = { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } };

/**
 * An orthonormal in-plane basis with `u × v = normal`, chosen so that leaning on the
 * ground plane puts +u on +X and +v on +Y: a typed `100, 50` then grows the rectangle
 * towards the user's view of positive space instead of away from it.
 */
function basisFor(normal: Vec3): { u: Vec3; v: Vec3 } {
  if (Math.abs(normal.z) > 0.9) {
    const u = { x: normal.z > 0 ? 1 : -1, y: 0, z: 0 };
    return { u, v: { x: 0, y: 1, z: 0 } };
  }
  const u = vec3.normalize(vec3.cross({ x: 0, y: 0, z: 1 }, normal));
  const v = vec3.normalize(vec3.cross(normal, u));
  return { u, v };
}

/**
 * A plane through a point that *contains* an axis and faces the camera as squarely as
 * possible. This is what makes a locked axis usable on the third dimension: with the
 * ground plane, a point locked to Z can never leave z = 0.
 */
function planeContainingAxis(axis: Vec3, origin: Vec3, viewDirection: Vec3): DrawingPlane {
  return axisPlaneBasis(axis, axisPlaneNormal(axis, viewDirection), origin);
}

/**
 * Owns the tool lifecycle, pointer routing, the typed-value buffer, and the axis lock.
 * Tools declare what numbers they accept and never see raw text (decision 0012).
 */
export class ToolController {
  private readonly store: Store;
  private readonly viewport: ViewportAdapter;
  private readonly onChange: () => void;
  private readonly tools: Map<ToolId, Tool>;

  private activeId: ToolId = "select";
  private cursor: Vec3 = { x: 0, y: 0, z: 0 };
  private snap: SnapResult | null = null;
  private preview: ToolPreview = EMPTY_PREVIEW;
  private typed = "";
  private lockSpec: { axisKey: "x" | "y" | "z"; sign: 1 | -1 } | null = null;
  private plane: DrawingPlane = {
    plane: GROUND_PLANE,
    normal: GROUND_PLANE.normal,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
  };

  constructor(store: Store, viewport: ViewportAdapter, onChange: () => void) {
    this.store = store;
    this.viewport = viewport;
    this.onChange = onChange;
    this.tools = new Map(createTools().map((tool) => [tool.id, tool]));
    this.tools.get(this.activeId)?.activate?.(this.context());
  }

  getActiveTool(): Tool {
    return this.tools.get(this.activeId) as Tool;
  }

  getActiveToolId(): ToolId {
    return this.activeId;
  }

  getToolMeta(id: ToolId): { label: string; shortcut: string } {
    const tool = this.tools.get(id);
    return { label: tool?.label ?? id, shortcut: tool?.shortcut ?? "" };
  }

  /** CSS cursor for the active tool. */
  getCursor(): string {
    return this.getActiveTool().cursor || "default";
  }

  setTool(id: ToolId): void {
    if (id === this.activeId) return;
    const previous = this.tools.get(this.activeId);
    previous?.deactivate?.(this.context());
    this.activeId = id;
    this.reset();
    this.getActiveTool().activate?.(this.context());
    this.onChange();
  }

  private reset(): void {
    this.typed = "";
    this.lockSpec = null;
    this.preview = EMPTY_PREVIEW;
  }

  /**
   * A context with no axis lock. Used to ask the tool for its anchor, which is what the
   * lock is built from — asking with a lock in place would recurse.
   */
  private bareContext(): ToolContext {
    const state = this.store.getState();
    return {
      doc: state,
      settings: state.settings,
      cursor: this.cursor,
      axisLock: null,
      dispatch: (command: Command | Command[]) => this.store.dispatch(command),
      preview: (next) => {
        this.preview = next;
      },
      pick: (x, y) => this.viewport.raycast(x, y),
      project: (point) => this.viewport.worldToScreen(point),
      planeAt: (x, y) => this.planeAt(x, y),
      viewPlaneAt: (point) => ({ origin: point, normal: vec3.neg(this.viewport.viewDirection()) }),
      viewDirection: () => this.viewport.viewDirection(),
      worldOnPlane: (x, y, plane) => this.viewport.raycastPlane(x, y, plane),
      pixelsPerWorldUnit: (at) => this.viewport.pixelsPerWorldUnit(at),
    };
  }

  private currentAnchor(): Vec3 | null {
    return this.getActiveTool().axisAnchor?.(this.bareContext()) ?? null;
  }

  private currentLock(): AxisLockState | null {
    if (!this.lockSpec) return null;
    const origin = this.currentAnchor() ?? this.cursor;
    const base =
      this.lockSpec.axisKey === "x"
        ? { x: 1, y: 0, z: 0 }
        : this.lockSpec.axisKey === "y"
          ? { x: 0, y: 1, z: 0 }
          : { x: 0, y: 0, z: 1 };
    return {
      axisKey: this.lockSpec.axisKey,
      direction: vec3.scale(base, this.lockSpec.sign),
      origin,
    };
  }

  private context(): ToolContext {
    const context = this.bareContext();
    context.axisLock = this.currentLock();
    return context;
  }

  private planeAt(screenX: number, screenY: number): DrawingPlane {
    const lock = this.currentLock();
    if (lock) {
      const anchor = this.currentAnchor();
      const origin =
        anchor ??
        this.viewport.raycastPlane(screenX, screenY, GROUND_PLANE) ??
        this.cursor;
      return planeContainingAxis(lock.direction, origin, this.viewport.viewDirection());
    }

    const hit = this.viewport.raycast(screenX, screenY);
    if (hit && hit.kind === "face") {
      const face = this.store.getState().entities[hit.entityId];
      if (face && face.kind === "face") {
        const positions = facePositions(this.store.getState(), face);
        const normal = polyOps.normal(positions);
        if (normal) {
          const plane = { origin: positions[0], normal };
          const { u, v } = basisFor(normal);
          return { plane, normal, u, v };
        }
      }
    }
    const { u, v } = basisFor(GROUND_PLANE.normal);
    return { plane: GROUND_PLANE, normal: GROUND_PLANE.normal, u, v };
  }

  private buildEvent(state: PointerState): ToolPointerEvent {
    this.plane = this.planeAt(state.screenX, state.screenY);
    const raw = this.viewport.raycastPlane(state.screenX, state.screenY, this.plane.plane) ?? this.cursor;
    const tolerance = this.viewport.pixelsPerWorldUnit(raw) * 12;
    const snap = resolveSnap({
      doc: this.store.getState(),
      free: raw,
      tolerance,
      anchor: this.currentAnchor(),
      lock: this.currentLock(),
      lockMode: this.getActiveTool().lockMode,
      ray: this.viewport.rayAt(state.screenX, state.screenY),
      screen: { x: state.screenX, y: state.screenY },
      project: (point) => this.viewport.worldToScreen(point),
      snapping: this.store.getState().settings.snapping,
    });
    this.snap = snap;
    this.cursor = snap.point;
    return {
      screenX: state.screenX,
      screenY: state.screenY,
      world: snap.point,
      raw,
      snap,
      shiftKey: state.shiftKey,
      ctrlKey: state.ctrlKey,
      altKey: state.altKey,
      metaKey: state.metaKey,
      button: state.button,
    };
  }

  pointerMove(state: PointerState): void {
    const event = this.buildEvent(state);
    this.preview = EMPTY_PREVIEW;
    this.getActiveTool().pointerMove?.(event, this.context());
    this.onChange();
  }

  pointerDown(state: PointerState): void {
    const event = this.buildEvent(state);
    this.getActiveTool().pointerDown?.(event, this.context());
    this.onChange();
  }

  pointerUp(state: PointerState): void {
    const event = this.buildEvent(state);
    this.getActiveTool().pointerUp?.(event, this.context());
    this.onChange();
  }

  pointerLeave(): void {
    this.snap = null;
    this.preview = EMPTY_PREVIEW;
    this.onChange();
  }

  /** Digits, separators and backspace. Returns true when the key belongs to the buffer. */
  typedKey(key: string): boolean {
    const tool = this.getActiveTool();
    if (!tool.numbers) return false;
    if (key === "Backspace") {
      this.typed = this.typed.slice(0, -1);
      this.onChange();
      return true;
    }
    if (key === "," && this.typed.includes(",")) {
      this.typed += ",";
      this.onChange();
      return true;
    }
    if (/^[0-9.,-]$/.test(key)) {
      this.typed += key;
      this.onChange();
      return true;
    }
    return false;
  }

  /** Enter: parse the buffer in the current unit and hand resolved values to the tool. */
  commitTyped(): boolean {
    const tool = this.getActiveTool();
    if (!tool.numbers || this.typed.trim() === "") return false;
    const parts = this.typed
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "");
    if (parts.length === 0 || parts.length > tool.numbers.max) return false;

    const unit = this.store.getState().settings.unit;
    const values: number[] = [];
    for (const part of parts) {
      const value = tool.numbers.kind === "angle" ? parseAngle(part) : parseLength(part, unit);
      if (value === null) return false;
      values.push(value);
    }

    tool.commitNumbers?.(values, this.context());
    this.typed = "";
    this.preview = EMPTY_PREVIEW;
    this.onChange();
    return true;
  }

  /** Arrow keys pin an axis; `↓` clears it. Returns true when the key was consumed. */
  pressKey(key: string, shift: boolean): boolean {
    if (key === "Escape") {
      this.cancel();
      return true;
    }
    if (key === "ArrowDown") {
      this.lockSpec = null;
      this.getActiveTool().invertDirection?.(this.context());
      this.onChange();
      return true;
    }
    const arrow = axisForArrow(key, shift);
    if (arrow) {
      this.lockSpec = { axisKey: arrow.axisKey, sign: arrow.sign };
      this.onChange();
      return true;
    }
    return false;
  }

  cancel(): void {
    this.typed = "";
    this.lockSpec = null;
    this.preview = EMPTY_PREVIEW;
    this.getActiveTool().cancel?.(this.context());
    this.onChange();
  }

  getPreview(): ToolPreview {
    return this.preview;
  }

  getSnapIndicator(): SnapIndicator | null {
    if (!this.snap) return null;
    if (this.snap.kind === "free" || this.snap.kind === "face") {
      if (!this.snap.axis) return null;
    }
    return {
      position: this.snap.point,
      kind: this.snap.axisKey ?? this.snap.kind,
      axis: this.snap.axis,
      axisKey: this.snap.axisKey,
    };
  }

  getStatus(): ToolStatus {
    const tool = this.getActiveTool();
    const state = this.store.getState();
    const context = this.context();
    return {
      toolId: tool.id,
      label: tool.label,
      hint: tool.hint,
      numberHint: tool.numbers?.example ?? null,
      typed: this.typed,
      readout: tool.readout?.(context) ?? null,
      snapLabel: this.snap?.label ?? "",
      axisKey: this.lockSpec?.axisKey ?? null,
      unit: state.settings.unit,
      suffix: unitSuffix(state.settings.unit),
      active: tool.isActive?.(context) ?? false,
    };
  }
}
