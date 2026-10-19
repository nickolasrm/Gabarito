import { attachComponentPlacement } from "./component-placement";
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
    let viewport: Viewport,
      controller: Controller,
      draggedComponent: string | null = null,
      placementMessage = "";
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
        snapping: true,
        circleSegments: 24,
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
        const detachPlacement = attachComponentPlacement(
          canvas,
          store,
          viewport,
          controller,
          () => draggedComponent,
          (message) => {
            placementMessage = message;
            for (const fn of listeners) fn();
          },
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
          detachPlacement();
          controller.dispose();
          viewport.dispose();
        };
      },
      selectTool(t) {
        controller.setTool(t as Tool);
        viewport.canvas.focus();
      },
      setCircleSegments(count) {
        controller.setCircleSegments(count);
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
      makeComponent(name) {
        controller.cancel();
        store.execute({
          type: "make-component",
          ids: store.getState().selection,
          name,
        });
        controller.setTool("select");
      },
      renameComponent(definition, name) {
        store.execute({ type: "rename-component", definition, name });
      },
      exitComponent() {
        controller.cancel();
        store.exitComponent();
      },
      placementError: () => placementMessage,
      dragComponent(id) {
        draggedComponent = id;
        placementMessage = "";
        if (id) {
          controller.cancel();
          controller.setTool("select");
        }
      },
    });
  } catch (error) {
    root.textContent = `Gabarito could not start: ${error instanceof Error ? error.message : String(error)}. Reload to retry.`;
  }
}
