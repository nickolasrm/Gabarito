import type { Vec3, Ray, Segment } from "@gabarito/geometry";
import type { Unit } from "@gabarito/core";
export type Tool =
  "select" | "line" | "rectangle" | "move" | "pushpull" | "rotate";
export const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  {
    id: "select",
    label: "Select",
    key: "Space",
    hint: "Click an entity. Shift adds or removes. Double-click selects connected geometry.",
  },
  {
    id: "line",
    label: "Line",
    key: "L",
    hint: "Click points to build a polygon. Type a length, Enter. Esc ends the chain.",
  },
  {
    id: "rectangle",
    label: "Rectangle",
    key: "R",
    hint: "Click a corner, then the opposite corner. Or type width,depth and Enter.",
  },
  {
    id: "move",
    label: "Move",
    key: "M",
    hint: "Select geometry, click a reference, then a destination. Type a distance, Enter.",
  },
  {
    id: "pushpull",
    label: "Push/Pull",
    key: "P",
    hint: "Click a face, then a depth. Type a signed distance, Enter. Negative cuts inward.",
  },
  {
    id: "rotate",
    label: "Rotate",
    key: "Q",
    hint: "Select geometry. Click pivot, reference, then angle. Or type degrees after pivot.",
  },
];
export interface ToolHit {
  id: string;
  kind: "vertex" | "edge" | "face";
  point: Vec3;
}
export interface ToolView {
  ray(x: number, y: number): Ray;
  project(p: Vec3): { x: number; y: number; visible: boolean };
  pick(x: number, y: number, faceOnly?: boolean): ToolHit | null;
  preview(lines: Segment[]): void;
}
export interface Status {
  tool: Tool;
  active: boolean;
  typed: string;
  axis: string;
  message: string;
  unit: Unit;
  measurement: string;
}
export interface Controller {
  status(): Status;
  subscribe(fn: () => void): () => void;
  setTool(t: Tool): void;
  setUnit(u: Unit): void;
  setTyped(s: string): void;
  submit(): void;
  pointer(
    x: number,
    y: number,
    click?: boolean,
    shift?: boolean,
    double?: boolean,
  ): void;
  key(key: string, ctrl?: boolean, shift?: boolean): boolean;
  cancel(): void;
}
