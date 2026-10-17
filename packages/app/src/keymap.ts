import type { Store } from "@gabarito/core";
import type { ToolController, ToolId } from "@gabarito/tools";
import type { Viewport } from "@gabarito/scene";

function shortcutToTool(key: string, shiftKey: boolean): ToolId | null {
  if (key === " " || key === "Spacebar") return "select";
  const lower = key.toLowerCase();
  if (shiftKey && lower === "t") return "measure";
  switch (lower) {
    case "l":
      return "line";
    case "r":
      return "rectangle";
    case "c":
      return "circle";
    case "p":
      return "pushpull";
    case "m":
      return "move";
    case "q":
      return "rotate";
    case "t":
      return "ruler";
    default:
      return null;
  }
}

/**
 * Global keys. Order matters: modal input (axis locks, typed values) is offered first,
 * so a digit never triggers a tool shortcut.
 */
export function installKeymap(
  store: Store,
  controller: ToolController,
  viewport: Viewport,
): () => void {
  const handler = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;

    const key = event.key;
    const modified = event.ctrlKey || event.metaKey;

    if (modified && key.toLowerCase() === "z") {
      if (event.shiftKey) store.redo();
      else store.undo();
      event.preventDefault();
      return;
    }
    if (modified && key.toLowerCase() === "y") {
      store.redo();
      event.preventDefault();
      return;
    }

    if (controller.pressKey(key, event.shiftKey)) {
      event.preventDefault();
      return;
    }

    if (key === "Enter") {
      if (controller.commitTyped()) event.preventDefault();
      return;
    }

    if (key === "Delete") {
      const selection = store.getState().selection;
      if (selection.length > 0) {
        store.dispatch({ type: "removeEntities", ids: selection });
        event.preventDefault();
      }
      return;
    }

    if (key === "Home") {
      viewport.frameDocument();
      event.preventDefault();
      return;
    }

    if (controller.typedKey(key)) {
      event.preventDefault();
      return;
    }

    const toolId = shortcutToTool(key, event.shiftKey);
    if (toolId) {
      controller.setTool(toolId);
      event.preventDefault();
    }
  };

  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
