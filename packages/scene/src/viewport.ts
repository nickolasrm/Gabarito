import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { V, sub, dot, unit, triangulate } from "@gabarito/geometry";
import type { Vec3, Segment, Ray } from "@gabarito/geometry";
import { vertices, edges, faces, position, surface } from "@gabarito/core";
import type { Store } from "@gabarito/core";
import { pick, faceHit } from "./pick";
import type { Hit, ScreenPoint } from "./pick";
export interface Viewport {
  canvas: HTMLCanvasElement;
  ray(x: number, y: number): Ray;
  project(p: Vec3): ScreenPoint;
  pick(x: number, y: number, faceOnly?: boolean): Hit | null;
  preview(lines: Segment[]): void;
  feedback(hit: Hit | null): void;
  frame(): void;
  dispose(): void;
  cameraState(): { position: Vec3; target: Vec3 };
}
export function createViewport(host: HTMLElement, store: Store): Viewport {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x151b22);
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "3D modeling viewport");
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1e8);
  camera.up.set(0, 0, 1);
  camera.position.set(300, -450, 350);
  const controls = new OrbitControls(camera, canvas);
  // Tool state owns the cursor; OrbitControls installs an inline default.
  canvas.style.removeProperty("cursor");
  controls.target.set(0, 0, 0);
  controls.enableDamping = false;
  // OrbitControls maps Shift+ROTATE to pan; keep MIDDLE bound to ROTATE.
  controls.mouseButtons = {
    LEFT: undefined as unknown as THREE.MOUSE,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: undefined as unknown as THREE.MOUSE,
  };
  const navigation = (event: PointerEvent) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };
  canvas.addEventListener("pointerdown", navigation, { capture: true });
  const noMenu = (e: Event) => e.preventDefault();
  canvas.addEventListener("contextmenu", noMenu);
  const grid = new THREE.GridHelper(2000, 40, 0x46505b, 0x28323d);
  grid.rotateX(Math.PI / 2);
  scene.add(grid);
  const axes = new THREE.AxesHelper(180);
  scene.add(axes);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x647080, 3));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(1, -2, 5);
  scene.add(light);
  const modelGroup = new THREE.Group(),
    previewGroup = new THREE.Group(),
    hoverGroup = new THREE.Group();
  scene.add(modelGroup, previewGroup, hoverGroup);
  const marker = document.createElement("div");
  marker.className = "snap-marker";
  marker.hidden = true;
  const label = document.createElement("span");
  label.className = "snap-label";
  marker.append(label);
  host.append(marker);
  let hoverId = "";
  const clearFeedback = () => feedback(null);
  controls.addEventListener("start", clearFeedback);
  const disposeGroup = (group: THREE.Group) => {
    for (const child of [...group.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
      group.remove(child);
    }
  };
  const lineObject = (
    segments: Segment[],
    color: number,
    depthTest = true,
  ): THREE.LineSegments => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      segments.flatMap((s) => s.map((p) => new THREE.Vector3(p.x, p.y, p.z))),
    );
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, depthTest }),
    );
  };
  const rebuild = () => {
    feedback(null);
    disposeGroup(modelGroup);
    const m = store.getState(),
      selected = new Set(m.selection),
      selectedPoints = new Set(
        m.selection.filter((id) => m.entities[id]?.kind === "vertex"),
      );
    for (const f of faces(m)) {
      const mesh = triangulate(surface(m, f)),
        g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          mesh.points.flatMap((p) => [p.x, p.y, p.z]),
          3,
        ),
      );
      g.setIndex(mesh.triangles);
      g.computeVertexNormals();
      modelGroup.add(
        new THREE.Mesh(
          g,
          new THREE.MeshStandardMaterial({
            color: selected.has(f.id) ? 0xe8ad59 : 0xb7c8cf,
            side: THREE.DoubleSide,
            roughness: 0.85,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          }),
        ),
      );
      modelGroup.children[modelGroup.children.length - 1].userData.entityId =
        f.id;
    }
    const regular: Segment[] = [],
      highlight: Segment[] = [];
    for (const e of edges(m))
      (selected.has(e.id) ? highlight : regular).push(
        e.vertices.map((id) => position(m, id)) as Segment,
      );
    modelGroup.add(
      lineObject(regular, 0x13191e),
      lineObject(highlight, 0xffbd69),
    );
    const points = vertices(m).filter((v) => selectedPoints.has(v.id));
    if (points.length) {
      const g = new THREE.BufferGeometry().setFromPoints(
        points.map(
          (v) => new THREE.Vector3(v.position.x, v.position.y, v.position.z),
        ),
      );
      modelGroup.add(
        new THREE.Points(
          g,
          new THREE.PointsMaterial({
            color: 0xffbd69,
            size: 7,
            sizeAttenuation: false,
          }),
        ),
      );
    }
  };
  const unsubscribe = store.subscribe(rebuild);
  const observer = new ResizeObserver(() => {
    feedback(null);
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  observer.observe(host);
  const asVec = (p: THREE.Vector3): Vec3 => V(p.x, p.y, p.z);
  const project = (p: Vec3): ScreenPoint => {
    camera.updateMatrixWorld();
    const point = new THREE.Vector3(p.x, p.y, p.z),
      q = point.clone().project(camera),
      forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const depth = dot(sub(p, asVec(camera.position)), asVec(forward));
    return {
      x: ((q.x + 1) * canvas.clientWidth) / 2,
      y: ((1 - q.y) * canvas.clientHeight) / 2,
      depth,
      visible: depth >= camera.near && q.z >= -1 && q.z <= 1,
    };
  };
  const ray = (x: number, y: number): Ray => {
    camera.updateMatrixWorld();
    const p = new THREE.Vector3(
      (x / canvas.clientWidth) * 2 - 1,
      1 - (y / canvas.clientHeight) * 2,
      0.5,
    ).unproject(camera);
    return {
      origin: asVec(camera.position),
      direction: unit(sub(asVec(p), asVec(camera.position))),
    };
  };
  function feedback(hit: Hit | null): void {
    marker.hidden = true;
    if (!hit) {
      hoverId = "";
      disposeGroup(hoverGroup);
      return;
    }
    if (hit.id !== hoverId) {
      hoverId = hit.id;
      disposeGroup(hoverGroup);
      const entity = store.getState().entities[hit.id];
      if (entity?.kind === "edge")
        hoverGroup.add(
          lineObject(
            [
              entity.vertices.map((id) =>
                position(store.getState(), id),
              ) as Segment,
            ],
            0x8cffe3,
          ),
        );
      if (entity?.kind === "face") {
        const rendered = modelGroup.children.find(
          (child) => child.userData.entityId === entity.id,
        ) as THREE.Mesh | undefined;
        if (rendered)
          hoverGroup.add(
            new THREE.Mesh(
              rendered.geometry.clone(),
              new THREE.MeshBasicMaterial({
                color: 0x69dfcc,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide,
                depthWrite: false,
              }),
            ),
          );
      }
    }
    if (hit.kind === "face") return;
    const p = project(hit.point);
    if (!p.visible) return;
    marker.hidden = false;
    marker.dataset.kind = hit.kind;
    marker.dataset.entityId = hit.id;
    marker.style.left = `${p.x}px`;
    marker.style.top = `${p.y}px`;
    label.textContent = hit.kind === "vertex" ? "Vertex" : "Edge";
  }
  let active = true;
  const render = () => {
    if (!active) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };
  rebuild();
  render();
  return {
    canvas,
    ray,
    project,
    pick(x, y, faceOnly = false) {
      const m = store.getState();
      return faceOnly
        ? faceHit(m, ray(x, y))
        : pick(m, { origin: asVec(camera.position), project, ray }, x, y);
    },
    feedback,
    preview(segments) {
      disposeGroup(previewGroup);
      previewGroup.add(lineObject(segments, 0x69dfcc, false));
    },
    frame() {
      feedback(null);
      const vs = vertices(store.getState());
      if (!vs.length) return;
      const box = new THREE.Box3().setFromPoints(
        vs.map(
          (v) => new THREE.Vector3(v.position.x, v.position.y, v.position.z),
        ),
      );
      const center = box.getCenter(new THREE.Vector3()),
        size = box.getSize(new THREE.Vector3()).length();
      const direction = camera.position
        .clone()
        .sub(controls.target)
        .normalize();
      controls.target.copy(center);
      camera.position
        .copy(center)
        .addScaledVector(direction, Math.max(size * 1.5, 10));
      camera.near = Math.max(size / 100000, 0.001);
      camera.updateProjectionMatrix();
      controls.update();
    },
    cameraState: () => ({
      position: asVec(camera.position),
      target: asVec(controls.target),
    }),
    dispose() {
      active = false;
      unsubscribe();
      observer.disconnect();
      controls.removeEventListener("start", clearFeedback);
      controls.dispose();
      canvas.removeEventListener("pointerdown", navigation, true);
      canvas.removeEventListener("contextmenu", noMenu);
      disposeGroup(modelGroup);
      disposeGroup(previewGroup);
      disposeGroup(hoverGroup);
      marker.remove();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      axes.geometry.dispose();
      (axes.material as THREE.Material[]).forEach((m) => m.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
