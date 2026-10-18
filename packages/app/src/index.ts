import { initializeGeometry } from "@gabarito/geometry";
import { createStore } from "@gabarito/core";
import { createViewport } from "@gabarito/scene";
import type { Viewport } from "@gabarito/scene";
import { createController, TOOLS } from "@gabarito/tools";
import type { Controller, Tool } from "@gabarito/tools";
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
        const local = (e: MouseEvent) => {
          const box = canvas.getBoundingClientRect();
          return { x: e.clientX - box.left, y: e.clientY - box.top };
        };
        const move = (e: PointerEvent) => {
          if (e.buttons === 0) {
            const { x, y } = local(e);
            controller.pointer(x, y);
          }
        };
        const click = (e: MouseEvent) => {
          if (e.button === 0) {
            canvas.focus();
            const { x, y } = local(e);
            controller.pointer(x, y, true, e.shiftKey, e.detail === 2);
          }
        };
        const key = (e: KeyboardEvent) => {
          const element = e.target as HTMLElement;
          if (element.closest("input,select,textarea") || e.altKey) return;
          if (
            e.key.toLowerCase() === "f" &&
            !e.ctrlKey &&
            !e.metaKey &&
            !controller.status().typed
          ) {
            viewport.frame();
            e.preventDefault();
            return;
          }
          if (controller.key(e.key, e.ctrlKey || e.metaKey, e.shiftKey))
            e.preventDefault();
        };
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("click", click);
        window.addEventListener("keydown", key);
        if (import.meta.env.DEV)
          (window as unknown as { __gabarito: unknown }).__gabarito = {
            store,
            viewport,
            controller,
          };
        for (const fn of listeners) fn();
        return () => {
          unsubscribe();
          canvas.removeEventListener("pointermove", move);
          canvas.removeEventListener("click", click);
          window.removeEventListener("keydown", key);
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
