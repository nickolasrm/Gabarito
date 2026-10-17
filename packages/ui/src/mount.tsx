import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { UiApi } from "./api";

export function mountUi(root: HTMLElement, api: UiApi): void {
  createRoot(root).render(<App api={api} />);
}
