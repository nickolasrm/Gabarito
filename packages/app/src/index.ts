import { initializeGeometry } from "@gabarito/geometry";
import { createStore } from "@gabarito/core";
import { createViewport } from "@gabarito/scene";
import type { Viewport } from "@gabarito/scene";
import { createController, TOOLS } from "@gabarito/tools";
import type { Controller, Tool } from "@gabarito/tools";
import { attachInput } from "./input";
import { mountUi } from "@gabarito/ui";
export async function boot({ root }: { root: HTMLElement }): Promise<void> {
  try {
    root.textContent = "Loading geometry engine…";
    await initializeGeometry();
    root.textContent = "";
    const store = createStore();
    let viewport: Viewport, controller: Controller;
    const status = () =>
      controller?.status() ?? {
        tool: "select" as Tool,
        active: false,
        typed: "",
        axis: "Free",
        message: "",
        unit: "mm" as const,
        measurement: "",
        plane: "Ground",
      };
    const listeners = new Set<() => void>();
    mountUi(root, {
      store,
      tools: TOOLS,
      status,
      subscribe(fn) {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
      attach(host) {
        viewport = createViewport(host, store);
        controller = createController(store, viewport);
        const unsubscribe = controller.subscribe(() => {
          for (const fn of listeners) fn();
        });
        const canvas = viewport.canvas;
        const detachInput = attachInput(canvas, controller, () =>
          viewport.frame(),
        );
        if (import.meta.env.DEV)
          (window as unknown as { __gabarito: unknown }).__gabarito = {
            store,
            viewport,
            controller,
          };
        for (const fn of listeners) fn();
        return () => {
          unsubscribe();
          detachInput();
          viewport.dispose();
        };
      },
      selectTool(t) {
        controller.setTool(t as Tool);
        viewport.canvas.focus();
      },
      setUnit(u) {
        controller.setUnit(u);
      },
      setTyped(t) {
        controller.setTyped(t);
      },
      submit() {
        controller.submit();
        viewport.canvas.focus();
      },
      undo() {
        controller.cancel();
        store.undo();
      },
      redo() {
        controller.cancel();
        store.redo();
      },
      remove() {
        controller.key("Delete");
      },
      frame() {
        viewport.frame();
      },
    });
  } catch (error) {
    root.textContent = `Gabarito could not start: ${error instanceof Error ? error.message : String(error)}. Reload to retry.`;
  }
}
