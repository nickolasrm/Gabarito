import { V, add, intersectPlane, plane } from "@gabarito/geometry";
import { expandModel, edges, position, createModel } from "@gabarito/core";
import type { Store } from "@gabarito/core";
import type { Viewport } from "@gabarito/scene";
import type { Controller } from "@gabarito/tools";

export const COMPONENT_MIME = "application/x-gabarito-component";
/** Native drag state is transient; only a validated drop creates an instance. */
export function attachComponentPlacement(
  canvas: HTMLCanvasElement,
  store: Store,
  view: Viewport,
  controller: Controller,
  dragged: () => string | null,
  report: (message: string) => void,
): () => void {
  const placement = (event: DragEvent) => {
    const box = canvas.getBoundingClientRect(),
      x = event.clientX - box.left,
      y = event.clientY - box.top;
    const hit = view.pick(x, y, event.altKey);
    return {
      x,
      y,
      hit: event.altKey ? null : hit,
      point:
        hit?.point ?? intersectPlane(view.ray(x, y), plane(V(), V(0, 0, 1))),
    };
  };
  const over = (event: DragEvent) => {
    const id = dragged(),
      d = id ? store.getState().definitions[id] : null;
    if (!d) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    const { point, hit, x, y } = placement(event);
    if (!point) {
      clear();
      return;
    }
    const m = expandModel({
      ...createModel(),
      ...d.geometry,
      definitions: store.getState().definitions,
    });
    const transform = (p: ReturnType<typeof V>) => add(p, point);
    view.preview(
      edges(m).map(
        (e) =>
          e.vertices.map((id) => transform(position(m, id))) as [
            ReturnType<typeof V>,
            ReturnType<typeof V>,
          ],
      ),
    );
    view.cursorHint(`Place ${d.name}`, x, y);
    view.feedback(hit);
  };
  const clear = () => {
    view.preview([]);
    view.cursorHint("", 0, 0);
    view.feedback(null);
  };
  const drop = (event: DragEvent) => {
    const definition = dragged() ?? event.dataTransfer?.getData(COMPONENT_MIME);
    if (!definition) return;
    event.preventDefault();
    const { point } = placement(event);
    clear();
    if (!point) {
      report("Aim at a surface or the ground to place a component");
      return;
    }
    try {
      controller.cancel();
      store.execute({ type: "place-component", definition, point });
      controller.setTool("select");
      report("");
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  canvas.addEventListener("dragover", over);
  canvas.addEventListener("drop", drop);
  canvas.addEventListener("dragleave", clear);
  window.addEventListener("dragend", clear);
  return () => {
    canvas.removeEventListener("dragover", over);
    canvas.removeEventListener("drop", drop);
    canvas.removeEventListener("dragleave", clear);
    window.removeEventListener("dragend", clear);
    clear();
  };
}
