import * as THREE from "three";
import { triangulate, vec3 } from "@gabarito/geometry";
import {
  dimensionsOf,
  edgesOf,
  facePositions,
  facesOf,
  getPoint,
  guidesOf,
} from "@gabarito/core";
import type { DocumentState, EntityId } from "@gabarito/core";

export const COLORS = {
  face: 0xf2f2ef,
  faceSide: 0xe4e4e0,
  edge: 0x1b1b1b,
  guide: 0x2f7d32,
  dimension: 0x1565c0,
  selection: 0x2f6fd0,
  selectionFill: 0x7aa7e8,
  preview: 0x2f6fd0,
  snap: 0xff9800,
  axisX: 0xd32f2f,
  axisY: 0x388e3c,
  axisZ: 0x1976d2,
} as const;

export interface SceneGraph {
  root: THREE.Group;
  faces: THREE.Group;
  edges: THREE.Group;
  guides: THREE.Group;
  dimensions: THREE.Group;
  selection: THREE.Group;
}

export function createSceneGraph(): SceneGraph {
  const root = new THREE.Group();
  const faces = new THREE.Group();
  const edges = new THREE.Group();
  const guides = new THREE.Group();
  const dimensions = new THREE.Group();
  const selection = new THREE.Group();
  root.add(faces, edges, guides, dimensions, selection);
  return { root, faces, edges, guides, dimensions, selection };
}

function disposeGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    const mesh = child as THREE.Mesh | THREE.LineSegments | THREE.Points;
    const geometry = (mesh as { geometry?: THREE.BufferGeometry }).geometry;
    if (geometry) geometry.dispose();
    const material = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else if (material) material.dispose();
  }
}

function faceGeometry(doc: DocumentState, ids: Set<EntityId> | null): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (const face of facesOf(doc)) {
    if (ids && !ids.has(face.id)) continue;
    const points = facePositions(doc, face);
    if (points.length < 3) continue;
    const base = positions.length / 3;
    for (const point of points) positions.push(point.x, point.y, point.z);
    const triangles = triangulate.polygon(points);
    for (let index = 0; index < triangles.length; index += 3) {
      indices.push(base + triangles[index], base + triangles[index + 1], base + triangles[index + 2]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  if (positions.length > 0) geometry.computeVertexNormals();
  return geometry;
}

function edgeGeometry(
  doc: DocumentState,
  ids: Set<EntityId> | null,
  exclude?: Set<EntityId>,
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const edge of edgesOf(doc)) {
    if (ids && !ids.has(edge.id)) continue;
    // A selected edge is drawn in the selection colour. Leaving the black base line in
    // place draws it over the selection, which reads as the selection being underneath.
    if (exclude?.has(edge.id)) continue;
    const a = getPoint(doc, edge.points[0]);
    const b = getPoint(doc, edge.points[1]);
    if (!a || !b) continue;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function pointGeometry(doc: DocumentState): THREE.BufferGeometry {
  const positions: number[] = [];
  const seen = new Set<EntityId>();
  for (const edge of edgesOf(doc)) {
    for (const id of edge.points) {
      if (seen.has(id)) continue;
      seen.add(id);
      const point = getPoint(doc, id);
      if (point) positions.push(point.x, point.y, point.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function guideGeometry(doc: DocumentState, extent: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const guide of guidesOf(doc)) {
    const a = vec3.add(guide.origin, vec3.scale(guide.direction, extent));
    const b = vec3.sub(guide.origin, vec3.scale(guide.direction, extent));
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function dimensionGeometry(doc: DocumentState): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const dimension of dimensionsOf(doc)) {
    positions.push(dimension.a.x, dimension.a.y, dimension.a.z);
    positions.push(dimension.b.x, dimension.b.y, dimension.b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function extentFor(doc: DocumentState): number {
  let extent = 0;
  for (const edge of edgesOf(doc)) {
    const a = getPoint(doc, edge.points[0]);
    const b = getPoint(doc, edge.points[1]);
    if (a && b) extent = Math.max(extent, vec3.dist(a, b));
  }
  return Math.max(extent * 20, 20_000);
}

/**
 * Rebuild the derived scene from the document. The scene graph is a view: it is thrown
 * away and rebuilt whenever the document revision moves, and nothing reads back from it.
 */
export function rebuildScene(graph: SceneGraph, doc: DocumentState): void {
  const extent = extentFor(doc);

  disposeGroup(graph.faces);
  const solid = new THREE.Mesh(
    faceGeometry(doc, null),
    new THREE.MeshStandardMaterial({
      color: COLORS.face,
      side: THREE.DoubleSide,
      flatShading: true,
      roughness: 0.9,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  graph.faces.add(solid);

  disposeGroup(graph.edges);
  graph.edges.add(
    new THREE.LineSegments(
      edgeGeometry(doc, null, new Set(doc.selection)),
      new THREE.LineBasicMaterial({ color: COLORS.edge }),
    ),
  );
  graph.edges.add(
    new THREE.Points(
      pointGeometry(doc),
      new THREE.PointsMaterial({ color: COLORS.edge, size: 5, sizeAttenuation: false }),
    ),
  );

  disposeGroup(graph.guides);
  const guideLines = new THREE.LineSegments(
    guideGeometry(doc, extent),
    new THREE.LineDashedMaterial({ color: COLORS.guide, dashSize: 40, gapSize: 30 }),
  );
  guideLines.computeLineDistances();
  graph.guides.add(guideLines);

  disposeGroup(graph.dimensions);
  const dimensionLines = new THREE.LineSegments(
    dimensionGeometry(doc),
    new THREE.LineDashedMaterial({ color: COLORS.dimension, dashSize: 30, gapSize: 20 }),
  );
  dimensionLines.computeLineDistances();
  graph.dimensions.add(dimensionLines);

  disposeGroup(graph.selection);
  if (doc.selection.length > 0) {
    const selected = new Set(doc.selection);
    graph.selection.add(
      new THREE.Mesh(
        faceGeometry(doc, selected),
        new THREE.MeshBasicMaterial({
          color: COLORS.selectionFill,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      ),
    );
    graph.selection.add(
      new THREE.LineSegments(
        edgeGeometry(doc, selected),
        new THREE.LineBasicMaterial({ color: COLORS.selection }),
      ),
    );
  }
}

export function disposeScene(graph: SceneGraph): void {
  disposeGroup(graph.faces);
  disposeGroup(graph.edges);
  disposeGroup(graph.guides);
  disposeGroup(graph.dimensions);
  disposeGroup(graph.selection);
}
