import type { Vec3, Ray, Segment } from "@gabarito/geometry";
import type { Unit, ReferenceLine } from "@gabarito/core";
export type Tool =
  "select" | "line" | "rectangle" | "move" | "pushpull" | "rotate" | "tape";
export const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  {
    id: "select",
    label: "Select",
    key: "Space",
    hint: "Click an entity. Shift adds or removes. Double-click selects a face and its boundary; triple-click selects connected geometry.",
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
    id: "tape",
    label: "Tape Measure",
    key: "T",
    hint: "Click a reference, then a destination, or drag and release. Read the distance at the cursor. Completion places an infinite construction ruler. Esc cancels.",
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
    hint: "Hold a face, drag, then release. Type a signed distance while holding for an exact size. Negative cuts inward.",
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
  kind: "vertex" | "edge" | "face" | "guide";
  snap?: "midpoint" | "intersection" | "origin";
  point: Vec3;
}
export interface ToolView {
  ray(x: number, y: number): Ray;
  project(p: Vec3): { x: number; y: number; visible: boolean };
  pick(x: number, y: number, faceOnly?: boolean): ToolHit | null;
  preview(lines: Segment[], rulers?: ReferenceLine[]): void;
  cursorHint(text: string, x: number, y: number): void;
  feedback(hit: ToolHit | null): void;
}
export interface Status {
  tool: Tool;
  active: boolean;
  typed: string;
  axis: string;
  message: string;
  unit: Unit;
  measurement: string;
  plane: string;
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
    clicks?: number,
  ): void;
  key(key: string, ctrl?: boolean, shift?: boolean): boolean;
  press(x: number, y: number): void;
  release(x: number, y: number): void;
  leave(): void;
  cancel(): void;
}
