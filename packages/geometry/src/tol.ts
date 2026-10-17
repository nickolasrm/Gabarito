import type { Vec3 } from "./vec3";

type EPSValues = {
  LENGTH: number;
  ANGLE: number;
  MERGE: number;
  PARALLEL: number;
};

export const EPS: EPSValues = {
  LENGTH: 1e-6,
  ANGLE: 1e-6,
  MERGE: 1e-4,
  PARALLEL: 1e-6,
};

export const AXES: { ORIGIN: Vec3; X: Vec3; Y: Vec3; Z: Vec3 } = {
  ORIGIN: { x: 0, y: 0, z: 0 },
  X: { x: 1, y: 0, z: 0 },
  Y: { x: 0, y: 1, z: 0 },
  Z: { x: 0, y: 0, z: 1 },
};
