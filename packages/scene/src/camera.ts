import * as THREE from "three";
import { vec3 } from "@gabarito/geometry";
import type { Bounds, Vec3 } from "@gabarito/geometry";

const MIN_DISTANCE = 1;
const MAX_DISTANCE = 50_000_000;
const MAX_PITCH = 1.5;

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

/**
 * Spherical orbit around a target, with +Z as world up (decision 0008).
 * Keeping the camera in spherical coordinates makes framing and panning trivial
 * and removes any gimbal problem at the poles.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  private target: Vec3 = { x: 0, y: 0, z: 0 };
  private distance = 6000;
  private yaw = -Math.PI / 4;
  private pitch = Math.PI / 5;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 1_000_000);
    this.camera.up.set(0, 0, 1);
    this.sync();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  getTarget(): Vec3 {
    return { ...this.target };
  }

  setTarget(target: Vec3): void {
    this.target = { ...target };
    this.sync();
  }

  setOrientation(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
    this.sync();
  }

  private sync(): void {
    const cosPitch = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + this.distance * cosPitch * Math.cos(this.yaw),
      this.target.y + this.distance * cosPitch * Math.sin(this.yaw),
      this.target.z + this.distance * Math.sin(this.pitch),
    );
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
    this.camera.updateMatrixWorld();
  }

  orbit(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * 0.006;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch + deltaY * 0.006));
    this.sync();
  }

  /** Pan in the view plane, in screen pixels. */
  pan(deltaX: number, deltaY: number, viewportHeight: number): void {
    const scale = this.worldPerPixel(this.target, viewportHeight);
    const forward = this.viewDirection();
    const right = vec3.normalize(vec3.cross(forward, { x: 0, y: 0, z: 1 }));
    const up = vec3.normalize(vec3.cross(right, forward));
    this.target = vec3.add(
      this.target,
      vec3.add(vec3.scale(right, -deltaX * scale), vec3.scale(up, deltaY * scale)),
    );
    this.sync();
  }

  /**
   * Exponential zoom. When `anchor` is given, the target slides toward it so the
   * point under the pointer stays put.
   */
  zoom(wheelDelta: number, anchor?: Vec3 | null): void {
    const factor = Math.exp(wheelDelta * 0.0012);
    const previous = this.distance;
    this.distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, previous * factor));
    if (anchor) {
      const shift = 1 - this.distance / previous;
      this.target = vec3.lerp(this.target, anchor, shift);
    }
    this.sync();
  }

  frame(bounds: Bounds | null): void {
    if (!bounds) {
      this.distance = 6000;
      this.target = { x: 0, y: 0, z: 0 };
      this.sync();
      return;
    }
    const center = vec3.scale(vec3.add(bounds.min, bounds.max), 0.5);
    const diagonal = vec3.dist(bounds.min, bounds.max);
    const radius = Math.max(diagonal * 0.6, 500);
    this.target = center;
    this.distance = radius / Math.sin((this.camera.fov * Math.PI) / 360);
    this.sync();
  }

  viewDirection(): Vec3 {
    return vec3.normalize(vec3.sub(this.target, this.camera.position as unknown as Vec3));
  }

  distanceToCamera(point: Vec3): number {
    return vec3.dist(point, this.camera.position as unknown as Vec3);
  }

  worldPerPixel(at: Vec3, viewportHeight: number): number {
    const worldHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.distanceToCamera(at);
    return worldHeight / Math.max(viewportHeight, 1);
  }

  worldToScreen(point: Vec3, width: number, height: number): ScreenPoint {
    const projected = new THREE.Vector3(point.x, point.y, point.z).project(this.camera);
    return {
      x: ((projected.x + 1) / 2) * width,
      y: ((1 - projected.y) / 2) * height,
      visible: projected.z > -1 && projected.z < 1,
    };
  }

  screenToRay(x: number, y: number, width: number, height: number): Ray {
    const ndc = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = raycaster.ray;
    return {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: vec3.normalize({ x: direction.x, y: direction.y, z: direction.z }),
    };
  }

  /** World point under the screen position, on the plane through the target facing the camera. */
  pointOnTargetPlane(x: number, y: number, width: number, height: number): Vec3 {
    const ray = this.screenToRay(x, y, width, height);
    const normal = vec3.neg(this.viewDirection());
    const denominator = vec3.dot(ray.direction, normal);
    if (Math.abs(denominator) < 1e-9) return this.target;
    const t = vec3.dot(vec3.sub(this.target, ray.origin), normal) / denominator;
    if (t <= 0) return this.target;
    return vec3.add(ray.origin, vec3.scale(ray.direction, t));
  }
}
