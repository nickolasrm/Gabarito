import { vec3 } from "@gabarito/geometry";
import {
  createStore,
  dimensionsOf,
  formatLengthWithUnit,
} from "@gabarito/core";
import { ToolController, TOOL_ORDER, type ToolId } from "@gabarito/tools";
import { Viewport, type PointerInfo } from "@gabarito/scene";
import { mountUi, type LabelItem, type ToolButton, type UiApi, type UiStatus } from "@gabarito/ui";
import { installKeymap } from "./keymap";

export interface BootOptions {
  root: HTMLElement;
}

/** Composition root: creates the store, viewport, tools and UI and wires them together. */
export function boot({ root }: BootOptions): void {
  const store = createStore({ unit: "mm", snapping: true, circleSegments: 24 });

  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const host = document.createElement("div");
  host.className = "viewport-host";
  const viewport = new Viewport(host, store);

  let controller: ToolController;
  controller = new ToolController(store, viewport, () => {
    viewport.setPreview(controller.getPreview());
    viewport.setSnap(controller.getSnapIndicator());
    viewport.setCursor(controller.getCursor());
    notify();
  });

  store.subscribe(notify);

  viewport.setHandlers({
    onPointerDown: (info: PointerInfo) => controller.pointerDown(info),
    onPointerMove: (info: PointerInfo) => controller.pointerMove(info),
    onPointerUp: (info: PointerInfo) => controller.pointerUp(info),
    onPointerLeave: () => controller.pointerLeave(),
    onCameraChange: notify,
  });

  const api: UiApi = {
    store,

    get tools(): ToolButton[] {
      return TOOL_ORDER.map((id) => {
        const tool = controller.getToolMeta(id);
        return { id, label: tool.label, shortcut: tool.shortcut, active: controller.getActiveToolId() === id };
      });
    },

    status(): UiStatus {
      const status = controller.getStatus();
      const selection = store.getState().selection;
      return {
        toolLabel: status.label,
        hint: status.hint,
        numberHint: status.numberHint,
        typed: status.typed,
        readout: status.readout,
        snapLabel: status.snapLabel,
        axisKey: status.axisKey,
        unit: status.unit,
        suffix: status.suffix,
        active: status.active,
        undoable: store.canUndo(),
        redoable: store.canRedo(),
        canDelete: selection.length > 0,
      };
    },

    labels(): LabelItem[] {
      const state = store.getState();
      const out: LabelItem[] = [];
      for (const dimension of dimensionsOf(state)) {
        const middle = vec3.lerp(dimension.a, dimension.b, 0.5);
        const projected = viewport.worldToScreen(middle);
        if (!projected.visible) continue;
        out.push({
          id: dimension.id,
          text: formatLengthWithUnit(vec3.dist(dimension.a, dimension.b), state.settings.unit),
          x: projected.x,
          y: projected.y,
        });
      }
      return out;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    attachViewport(container) {
      container.appendChild(host);
      viewport.markDirty();
    },

    selectTool(id) {
      controller.setTool(id as ToolId);
    },

    setUnit(unit) {
      store.dispatch({ type: "setSettings", patch: { unit: unit as never } });
    },

    setSnapping(value) {
      store.dispatch({ type: "setSettings", patch: { snapping: value } });
    },

    setCircleSegments(value) {
      const segments = Math.max(3, Math.min(256, Math.round(value) || 3));
      store.dispatch({ type: "setSettings", patch: { circleSegments: segments } });
    },

    undo() {
      store.undo();
    },

    redo() {
      store.redo();
    },

    deleteSelection() {
      const selection = store.getState().selection;
      if (selection.length > 0) store.dispatch({ type: "removeEntities", ids: selection });
    },

    frameAll() {
      viewport.frameDocument();
      notify();
    },
  };

  mountUi(root, api);
  installKeymap(store, controller, viewport);
  viewport.setCursor(controller.getCursor());
  viewport.frameDocument();

  // Dev-only handle so end-to-end tests can assert real document state rather than
  // guessing from pixels. Removed from production builds by the bundler.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__gabarito = {
      store,
      controller,
      viewport,
      activeTool: () => controller.getActiveToolId(),
    };
  }
}
