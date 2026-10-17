import type { Tool, ToolId } from "../types";
import { createCircleTool } from "./circle";
import { createLineTool } from "./line";
import { createMeasureTool } from "./measure";
import { createMoveTool } from "./move";
import { createPushPullTool } from "./pushpull";
import { createRectangleTool } from "./rectangle";
import { createRotateTool } from "./rotate";
import { createRulerTool } from "./ruler";
import { createSelectTool } from "./select";

/** Toolbar order. Built-in tools are not plugins (docs/features/README.md). */
export const TOOL_ORDER: ToolId[] = [
  "select",
  "line",
  "rectangle",
  "circle",
  "pushpull",
  "move",
  "rotate",
  "ruler",
  "measure",
];

export function createTools(): Tool[] {
  return [
    createSelectTool(),
    createLineTool(),
    createRectangleTool(),
    createCircleTool(),
    createPushPullTool(),
    createMoveTool(),
    createRotateTool(),
    createRulerTool(),
    createMeasureTool(),
  ];
}

export {
  createCircleTool,
  createLineTool,
  createMeasureTool,
  createMoveTool,
  createPushPullTool,
  createRectangleTool,
  createRotateTool,
  createRulerTool,
  createSelectTool,
};
