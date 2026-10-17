import type { Vec3 } from "@gabarito/geometry";

export type { Vec3 };

export type EntityId = string;

export type UnitId = "mm" | "cm" | "m" | "km" | "in" | "ft" | "yd";

export interface Settings {
  /** Display and typed-input unit. Geometry is always stored in millimetres. */
  unit: UnitId;
  /** Master switch for inference. Axis locks still work when this is off. */
  snapping: boolean;
  /** Segments used when tessellating a circle at creation time. */
  circleSegments: number;
}

export interface PointEntity {
  id: EntityId;
  kind: "point";
  position: Vec3;
}

export interface EdgeEntity {
  id: EntityId;
  kind: "edge";
  points: [EntityId, EntityId];
}

export interface FaceEntity {
  id: EntityId;
  kind: "face";
  /** Ordered, closed loop of point ids. */
  points: EntityId[];
}

/** A construction line: infinite, snappable, never an operand of a solid operation. */
export interface GuideEntity {
  id: EntityId;
  kind: "guide";
  origin: Vec3;
  direction: Vec3;
}

/** A distance annotation. Purely presentational. */
export interface DimensionEntity {
  id: EntityId;
  kind: "dimension";
  a: Vec3;
  b: Vec3;
}

export type GeometricEntity = PointEntity | EdgeEntity | FaceEntity;
export type Entity = GeometricEntity | GuideEntity | DimensionEntity;

export interface DocumentState {
  /** Bumped on every change; views rebuild when it moves. */
  revision: number;
  /** Monotonic id counter. Never decreases, so ids are never reused. */
  nextId: number;
  entities: Record<EntityId, Entity>;
  selection: EntityId[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: "mm",
  snapping: true,
  circleSegments: 24,
};
