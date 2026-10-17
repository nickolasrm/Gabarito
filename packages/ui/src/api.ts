import type { Store } from "@gabarito/core";

/** View-model types owned by the UI. `app` adapts the tools and viewport into these. */
export interface ToolButton {
  id: string;
  label: string;
  shortcut: string;
  active: boolean;
}

export interface UiStatus {
  toolLabel: string;
  hint: string;
  numberHint: string | null;
  typed: string;
  readout: string | null;
  snapLabel: string;
  axisKey: "x" | "y" | "z" | null;
  unit: string;
  suffix: string;
  active: boolean;
  undoable: boolean;
  redoable: boolean;
  canDelete: boolean;
}

export interface LabelItem {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface UiApi {
  store: Store;
  tools: ToolButton[];
  status(): UiStatus;
  labels(): LabelItem[];
  /** Fires whenever anything the UI displays changes. */
  subscribe(listener: () => void): () => void;
  /** Called once, with the element the viewport canvas should live in. */
  attachViewport(container: HTMLElement): void;
  selectTool(id: string): void;
  setUnit(unit: string): void;
  setSnapping(value: boolean): void;
  setCircleSegments(value: number): void;
  undo(): void;
  redo(): void;
  deleteSelection(): void;
  frameAll(): void;
}
