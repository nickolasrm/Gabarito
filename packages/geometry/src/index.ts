export type { Vec3 } from "./vec3";
export { vec3, angle } from "./vec3";

export { EPS, AXES } from "./tol";

export type { Plane } from "./plane";
export { plane } from "./plane";

export type { Segment } from "./segment";
export { segment } from "./segment";

export type { Ray } from "./ray";
export { ray } from "./ray";

export type { Bounds } from "./bounds";
export { bounds } from "./bounds";

export { poly } from "./poly";

export { triangulate } from "./triangulate";

export type { MeshData } from "./extrude";
export { extrude } from "./extrude";

export { transform } from "./transform";
export * from "./rect";
export type { ShellFace, SolidMesh } from "./solid";
export { ensureSolid, solidReady, subtractShell, subtractSolid } from "./solid";
