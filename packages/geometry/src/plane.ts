import { vec3, type Vec3 } from "./vec3";
import { AXES, EPS } from "./tol";

export type Plane = { origin: Vec3; normal: Vec3 };

const fromPoints = (a: Vec3, b: Vec3, c: Vec3): Plane | null => {
  const normal = vec3.normalize(vec3.cross(vec3.sub(b, a), vec3.sub(c, a)));
  if (vec3.isZero(normal, EPS.LENGTH)) return null;
  return { origin: vec3.clone(a), normal };
};

const fromPointNormal = (origin: Vec3, normal: Vec3): Plane => {
  const n = vec3.normalize(normal);
  if (vec3.isZero(n, EPS.LENGTH)) throw new Error("plane.fromPointNormal: zero-length normal");
  return { origin: vec3.clone(origin), normal: n };
};

const fromAxis = (origin: Vec3, axis: "x" | "y" | "z"): Plane => {
  const normal = axis === "x" ? AXES.X : axis === "y" ? AXES.Y : AXES.Z;
  return { origin: vec3.clone(origin), normal: vec3.clone(normal) };
};

const distanceToPoint = (p: Plane, point: Vec3): number =>
  vec3.dot(vec3.sub(point, p.origin), p.normal);

const projectPoint = (p: Plane, point: Vec3): Vec3 =>
  vec3.sub(point, vec3.scale(p.normal, distanceToPoint(p, point)));

const contains = (p: Plane, point: Vec3, eps: number = EPS.LENGTH): boolean =>
  Math.abs(distanceToPoint(p, point)) <= eps;

const flip = (p: Plane): Plane => ({ origin: vec3.clone(p.origin), normal: vec3.neg(p.normal) });

export const plane = {
  fromPoints,
  fromPointNormal,
  fromAxis,
  distanceToPoint,
  projectPoint,
  contains,
  flip,
};
