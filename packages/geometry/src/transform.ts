import { vec3, type Vec3 } from "./vec3";
import { EPS } from "./tol";
import { plane as planeOps, type Plane } from "./plane";

const rotatePointAroundAxis = (
  point: Vec3,
  axisOrigin: Vec3,
  axisDirection: Vec3,
  radians: number,
): Vec3 => {
  const k = vec3.normalize(axisDirection);
  if (vec3.isZero(k, EPS.LENGTH)) return vec3.clone(point);
  const v = vec3.sub(point, axisOrigin);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Rodrigues' rotation formula.
  const rotated = vec3.add(
    vec3.add(vec3.scale(v, cos), vec3.scale(vec3.cross(k, v), sin)),
    vec3.scale(k, vec3.dot(k, v) * (1 - cos)),
  );
  return vec3.add(axisOrigin, rotated);
};

const rotatePointsAroundAxis = (
  points: Vec3[],
  axisOrigin: Vec3,
  axisDirection: Vec3,
  radians: number,
): Vec3[] => points.map((p) => rotatePointAroundAxis(p, axisOrigin, axisDirection, radians));

const translate = (point: Vec3, delta: Vec3): Vec3 => vec3.add(point, delta);

const translatePoints = (points: Vec3[], delta: Vec3): Vec3[] =>
  points.map((p) => vec3.add(p, delta));

const mirrorPoint = (point: Vec3, p: Plane): Vec3 =>
  vec3.sub(point, vec3.scale(p.normal, 2 * planeOps.distanceToPoint(p, point)));

export const transform = {
  rotatePointAroundAxis,
  rotatePointsAroundAxis,
  translate,
  translatePoints,
  mirrorPoint,
};
