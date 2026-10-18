import { V } from "@gabarito/geometry";
import type { Vec3 } from "@gabarito/geometry";
import type { Model, Guide } from "./model";

export interface ReferenceLine {
  readonly id: string;
  readonly origin: Vec3;
  readonly direction: Vec3;
}
export const WORLD_AXES: readonly ReferenceLine[] = [
  { id: "world:x", origin: V(), direction: V(1, 0, 0) },
  { id: "world:y", origin: V(), direction: V(0, 1, 0) },
  { id: "world:z", origin: V(), direction: V(0, 0, 1) },
];
export const guides = (m: Model): Guide[] =>
  Object.values(m.entities).filter((e): e is Guide => e.kind === "guide");
export const referenceLines = (m: Model): ReferenceLine[] => [
  ...WORLD_AXES,
  ...guides(m),
];
