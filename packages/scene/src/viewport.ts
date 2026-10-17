import * as THREE from "three";
import { vec3 } from "@gabarito/geometry";
import type { Plane, Vec3 } from "@gabarito/geometry";
import { documentBounds, type Store } from "@gabarito/core";
import { CameraController, type ScreenPoint } from "./camera";
import { COLORS, createSceneGraph, disposeScene, extentFor, rebuildScene, type SceneGraph } from "./build-scene";
import type { Ray } from "./camera";
import { pick, pickFace, type PickHit } from "./pick";

export interface PointerInfo {
  /** Position in CSS pixels relative to the canvas. */
  screenX: number;
  screenY: number;
  button: number;
  buttons: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface ViewportHandlers {
  onPointerMove?: (info: PointerInfo) => void;
  onPointerDown?: (info: PointerInfo) => void;
  onPointerUp?: (info: PointerInfo) => void;
  onPointerLeave?: () => void;
  onDoubleClick?: (info: PointerInfo) => void;
  /** Fires when the camera moved, so screen-anchored UI can follow. */
  onCameraChange?: () => void;
}

export interface PreviewSegment {
  a: Vec3;
  b: Vec3;
  color?: number;
}

export interface PreviewPolygon {
  points: Vec3[];
  color?: number;
  opacity?: number;
}

export interface PreviewPoint {
  position: Vec3;
  color?: number;
}

/** In-progress drawing, produced by tools and drawn above the document. */
export interface PreviewData {
  segments: PreviewSegment[];
  polygons: PreviewPolygon[];
  points: PreviewPoint[];
}

export interface SnapData {
  position: Vec3;
  kind: string;
  axis: { origin: Vec3; direction: Vec3 } | null;
  axisKey: "x" | "y" | "z" | null;
}

export const EMPTY_PREVIEW: PreviewData = { segments: [], polygons: [], points: [] };

const AXIS_COLORS: Record<string, number> = {
  x: COLORS.axisX,
  y: COLORS.axisY,
  z: COLORS.axisZ,
};

export class Viewport {
  private readonly container: HTMLElement;
  private readonly store: Store;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly graph: SceneGraph;
  private readonly cameraController: CameraController;
  private readonly previewGroup: THREE.Group;
  private readonly snapGroup: THREE.Group;
  private grid: THREE.GridHelper;
  private observers: ResizeObserver | null = null;
  private handlers: ViewportHandlers = {};
  private unsubscribe: () => void = () => {};
  private dirty = true;
  private frameHandle = 0;
  private orbiting = false;
  private panning = false;
  private lastX = 0;
  private lastY = 0;
  private gridSize = 0;
  private currentCursor = "";

  constructor(container: HTMLElement, store: Store) {
    this.container = container;
    this.store = store;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf7f7f5, 1);

    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.cameraController = new CameraController();
    this.graph = createSceneGraph();
    this.scene.add(this.graph.root);

    this.previewGroup = new THREE.Group();
    this.snapGroup = new THREE.Group();
    // Overlays are interface, not geometry: they must never be occluded by the model.
    this.previewGroup.renderOrder = 10;
    this.snapGroup.renderOrder = 11;
    this.scene.add(this.previewGroup, this.snapGroup);

    this.grid = new THREE.GridHelper(40_000, 400, 0xc8c8c4, 0xe2e2de);
    this.grid.rotation.x = Math.PI / 2;
    this.scene.add(this.grid);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x9a9a94, 2.2);
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(0.4, -0.7, 1);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-0.6, 0.5, 0.4);
    this.scene.add(ambient, key, fill);

    this.attachCanvasEvents(canvas);
    this.unsubscribe = store.subscribe(() => {
      rebuildScene(this.graph, store.getState());
      this.syncGrid();
      this.markDirty();
    });
    rebuildScene(this.graph, store.getState());
    this.syncGrid();

    this.resize();
    this.observers = new ResizeObserver(() => this.resize());
    this.observers.observe(container);
    this.loop();
  }

  private syncGrid(): void {
    const extent = extentFor(this.store.getState());
    const size = Math.max(20_000, extent * 2);
    if (this.gridSize === size) return;
    this.gridSize = size;
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.grid = new THREE.GridHelper(size, Math.max(20, Math.round(size / 100)), 0xc8c8c4, 0xe2e2de);
    this.grid.rotation.x = Math.PI / 2;
    this.scene.add(this.grid);
  }

  private attachCanvasEvents(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId);
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      if (event.button === 1) {
        this.orbiting = true;
        this.panning = event.shiftKey;
        event.preventDefault();
        return;
      }
      if (event.button === 0) this.emit("down", event);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (this.orbiting) {
        const deltaX = event.clientX - this.lastX;
        const deltaY = event.clientY - this.lastY;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        if (this.panning) {
          this.cameraController.pan(deltaX, deltaY, this.height());
        } else {
          this.cameraController.orbit(deltaX, deltaY);
        }
        this.handlers.onCameraChange?.();
        this.markDirty();
        return;
      }
      this.emit("move", event);
    });

    const endPointer = (event: PointerEvent) => {
      if (event.button === 1) {
        this.orbiting = false;
        this.panning = false;
        return;
      }
      if (event.button === 0) this.emit("up", event);
    };

    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", () => {
      this.orbiting = false;
      this.panning = false;
    });

    canvas.addEventListener("pointerleave", () => {
      this.handlers.onPointerLeave?.();
      this.markDirty();
    });

    canvas.addEventListener("dblclick", (event) => {
      this.handlers.onDoubleClick?.(this.infoFor(event));
    });

    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const anchor = this.cameraController.pointOnTargetPlane(
          event.clientX - rect.left,
          event.clientY - rect.top,
          this.width(),
          this.height(),
        );
        this.cameraController.zoom(event.deltaY, anchor);
        this.handlers.onCameraChange?.();
        this.markDirty();
      },
      { passive: false },
    );
  }

  private infoFor(event: PointerEvent | MouseEvent): PointerInfo {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
      button: event.button,
      buttons: "buttons" in event ? event.buttons : 0,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    };
  }

  private emit(kind: "down" | "move" | "up", event: PointerEvent): void {
    const info = this.infoFor(event);
    if (kind === "down") this.handlers.onPointerDown?.(info);
    else if (kind === "move") this.handlers.onPointerMove?.(info);
    else this.handlers.onPointerUp?.(info);
  }

  setHandlers(handlers: ViewportHandlers): void {
    this.handlers = handlers;
  }

  /** CSS cursor for the canvas. Cheap to call on every change; only writes when it differs. */
  setCursor(cursor: string): void {
    if (this.currentCursor === cursor) return;
    this.currentCursor = cursor;
    this.renderer.domElement.style.cursor = cursor;
  }

  width(): number {
    return this.container.clientWidth || 1;
  }

  height(): number {
    return this.container.clientHeight || 1;
  }

  private resize(): void {
    const width = this.width();
    const height = this.height();
    this.renderer.setSize(width, height, false);
    this.cameraController.setAspect(width / height);
    this.markDirty();
  }

  markDirty(): void {
    this.dirty = true;
  }

  private loop = (): void => {
    this.frameHandle = requestAnimationFrame(this.loop);
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.cameraController.camera);
  };

  setPreview(data: PreviewData): void {
    clearGroup(this.previewGroup);
    for (const polygon of data.polygons) {
      if (polygon.points.length < 3) continue;
      const geometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      for (const point of polygon.points) positions.push(point.x, point.y, point.z);
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const indices: number[] = [];
      for (let index = 1; index < polygon.points.length - 1; index += 1) {
        indices.push(0, index, index + 1);
      }
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      this.previewGroup.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: polygon.color ?? COLORS.preview,
            transparent: true,
            opacity: polygon.opacity ?? 0.35,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
          }),
        ),
      );
    }

    if (data.segments.length > 0) {
      const positions: number[] = [];
      const colors: number[] = [];
      const temporary = new THREE.Color();
      for (const segment of data.segments) {
        positions.push(segment.a.x, segment.a.y, segment.a.z, segment.b.x, segment.b.y, segment.b.z);
        temporary.setHex(segment.color ?? COLORS.preview);
        colors.push(temporary.r, temporary.g, temporary.b, temporary.r, temporary.g, temporary.b);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      this.previewGroup.add(
        new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false }),
        ),
      );
    }

    if (data.points.length > 0) {
      const positions: number[] = [];
      for (const point of data.points) positions.push(point.position.x, point.position.y, point.position.z);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      this.previewGroup.add(
        new THREE.Points(
          geometry,
          new THREE.PointsMaterial({
            color: COLORS.preview,
            size: 7,
            sizeAttenuation: false,
            depthTest: false,
            depthWrite: false,
          }),
        ),
      );
    }

    this.markDirty();
  }

  setSnap(data: SnapData | null): void {
    clearGroup(this.snapGroup);
    if (data) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([data.position.x, data.position.y, data.position.z], 3),
      );
      this.snapGroup.add(
        new THREE.Points(
          geometry,
          new THREE.PointsMaterial({
            color: COLORS.snap,
            size: 13,
            sizeAttenuation: false,
            depthTest: false,
            depthWrite: false,
          }),
        ),
      );

      if (data.axis) {
        const extent = extentFor(this.store.getState());
        const a = vec3.sub(data.axis.origin, vec3.scale(data.axis.direction, extent));
        const b = vec3.add(data.axis.origin, vec3.scale(data.axis.direction, extent));
        const axisGeometry = new THREE.BufferGeometry();
        axisGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z], 3),
        );
        const color = AXIS_COLORS[data.axisKey ?? ""] ?? COLORS.snap;
        const axisLines = new THREE.LineSegments(
          axisGeometry,
          new THREE.LineDashedMaterial({ color, dashSize: 60, gapSize: 40 }),
        );
        axisLines.computeLineDistances();
        this.snapGroup.add(axisLines);
      }
    }
    this.markDirty();
  }

  worldToScreen(point: Vec3): ScreenPoint {
    return this.cameraController.worldToScreen(point, this.width(), this.height());
  }

  pixelsPerWorldUnit(at: Vec3): number {
    return this.cameraController.worldPerPixel(at, this.height());
  }

  viewDirection(): Vec3 {
    return this.cameraController.viewDirection();
  }

  /** Snap tolerance in world units for a point: a constant distance in screen pixels. */
  toleranceAt(at: Vec3, pixels = 12): number {
    return this.pixelsPerWorldUnit(at) * pixels;
  }

  /** The pointer ray in world space, for inference that has to leave the drawing plane. */
  rayAt(screenX: number, screenY: number): Ray {
    return this.cameraController.screenToRay(screenX, screenY, this.width(), this.height());
  }

  /** The face under the pointer, ignoring nearer points and edges. Used to pick a drawing plane. */
  raycastFace(screenX: number, screenY: number): PickHit | null {
    const ray = this.cameraController.screenToRay(screenX, screenY, this.width(), this.height());
    return pickFace(ray, this.store.getState());
  }

  raycast(screenX: number, screenY: number): PickHit | null {
    const ray = this.cameraController.screenToRay(screenX, screenY, this.width(), this.height());
    const reference = this.cameraController.getTarget();
    return pick(ray, this.store.getState(), this.toleranceAt(reference));
  }

  raycastPlane(screenX: number, screenY: number, plane: Plane): Vec3 | null {
    const ray = this.cameraController.screenToRay(screenX, screenY, this.width(), this.height());
    return planeIntersection(ray.origin, ray.direction, plane);
  }

  frameDocument(): void {
    this.cameraController.frame(documentBoundsOf(this.store));
    this.handlers.onCameraChange?.();
    this.markDirty();
  }

  resetView(): void {
    const target = this.cameraController.getTarget();
    this.cameraController.setTarget(target);
    this.cameraController.setOrientation(-Math.PI / 4, Math.PI / 5);
    this.handlers.onCameraChange?.();
    this.markDirty();
  }

  centerView(): void {
    this.cameraController.setTarget(centerOf(this.store));
    this.handlers.onCameraChange?.();
    this.markDirty();
  }

  getCameraController(): CameraController {
    return this.cameraController;
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    this.unsubscribe();
    this.observers?.disconnect();
    disposeScene(this.graph);
    clearGroup(this.previewGroup);
    clearGroup(this.snapGroup);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    const object = child as THREE.Mesh;
    object.geometry?.dispose();
    const material = object.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else if (material) material.dispose();
  }
}

function planeIntersection(origin: Vec3, direction: Vec3, plane: Plane): Vec3 | null {
  const denominator = vec3.dot(direction, plane.normal);
  if (Math.abs(denominator) < 1e-9) return null;
  const t = vec3.dot(vec3.sub(plane.origin, origin), plane.normal) / denominator;
  if (t < 0) return null;
  return vec3.add(origin, vec3.scale(direction, t));
}

function documentBoundsOf(store: Store) {
  return documentBounds(store.getState());
}

function centerOf(store: Store): Vec3 {
  const bounds = documentBoundsOf(store);
  if (!bounds) return { x: 0, y: 0, z: 0 };
  return vec3.scale(vec3.add(bounds.min, bounds.max), 0.5);
}
