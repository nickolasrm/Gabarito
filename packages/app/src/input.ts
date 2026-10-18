import type { Controller } from "@gabarito/tools";

/** Browser pointer lifecycle; tool geometry stays in the headless controller. */
export function attachInput(
  canvas: HTMLCanvasElement,
  controller: Controller,
  frame: () => void,
): () => void {
  let dragPointer: number | null = null;
  const local = (event: MouseEvent) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const down = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      !["pushpull", "tape"].includes(controller.status().tool)
    )
      return;
    canvas.focus();
    controller.setSnapping(!event.altKey);
    const { x, y } = local(event);
    controller.press(x, y);
    if (controller.status().active) {
      dragPointer = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (
      event.buttons === 0 ||
      (event.pointerId === dragPointer &&
        ["pushpull", "tape"].includes(controller.status().tool))
    ) {
      controller.setSnapping(!event.altKey);
      const { x, y } = local(event);
      controller.pointer(x, y);
    }
  };
  const releaseCapture = () => {
    const id = dragPointer;
    dragPointer = null;
    if (id !== null && canvas.hasPointerCapture(id))
      canvas.releasePointerCapture(id);
  };
  const up = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerId !== dragPointer) return;
    const { x, y } = local(event);
    releaseCapture();
    controller.setSnapping(!event.altKey);
    controller.release(x, y);
  };
  const abort = () => {
    if (dragPointer !== null) {
      releaseCapture();
      controller.cancel();
    } else if (
      controller.status().tool === "tape" &&
      controller.status().active
    ) {
      controller.cancel();
    }
  };
  const lost = (event: PointerEvent) => {
    if (event.pointerId === dragPointer) abort();
  };
  const leave = () => controller.leave();
  const click = (event: MouseEvent) => {
    if (
      event.button !== 0 ||
      ["pushpull", "tape"].includes(controller.status().tool)
    )
      return;
    canvas.focus();
    controller.setSnapping(!event.altKey);
    const { x, y } = local(event);
    controller.pointer(x, y, true, event.shiftKey, event.detail);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Alt") {
      controller.setSnapping(false);
      event.preventDefault();
      return;
    }
    const element = event.target as HTMLElement;
    if (element.closest("input,select,textarea") || event.altKey) return;
    if (
      event.key.toLowerCase() === "f" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !controller.status().typed
    ) {
      frame();
      event.preventDefault();
      return;
    }
    if (
      controller.key(event.key, event.ctrlKey || event.metaKey, event.shiftKey)
    )
      event.preventDefault();
  };
  const keyup = (event: KeyboardEvent) => {
    if (event.key === "Alt") {
      controller.setSnapping(true);
      event.preventDefault();
    }
  };
  const blur = () => {
    abort();
    controller.setSnapping(true);
    controller.leave();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", abort);
  canvas.addEventListener("lostpointercapture", lost);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("click", click);
  window.addEventListener("keydown", key);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  return () => {
    abort();
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", abort);
    canvas.removeEventListener("lostpointercapture", lost);
    canvas.removeEventListener("pointerleave", leave);
    canvas.removeEventListener("click", click);
    window.removeEventListener("keydown", key);
    window.removeEventListener("keyup", keyup);
    window.removeEventListener("blur", blur);
  };
}
