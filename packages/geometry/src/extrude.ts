import { vec3, type Vec3 } from "./vec3";
import { poly as polyOps } from "./poly";
import { triangulate } from "./triangulate";

export type MeshData = { positions: number[]; indices: number[] };

const flatten = (points: Vec3[]): number[] => {
  const out: number[] = [];
  for (const p of points) out.push(p.x, p.y, p.z);
  return out;
};

const walls = (points: Vec3[], direction: Vec3): MeshData => {
  const n = points.length;
  if (n < 3) return { positions: [], indices: [] };
  const top = points.map((p) => vec3.add(p, direction));
  const positions = flatten(points).concat(flatten(top));
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Quad [p_i, p_j, p_j+d, p_i+d]; each triangle's normal is cross(edge, d), outward
    // for a loop wound CCW about the extrusion direction.
    indices.push(i, j, j + n, i, j + n, i + n);
  }
  return { positions, indices };
};

const cap = (points: Vec3[], normal: Vec3): MeshData => {
  const n = points.length;
  if (n < 3) return { positions: [], indices: [] };
  const loop = polyOps.orient(points, normal);
  return { positions: flatten(loop), indices: triangulate.polygon(loop, normal) };
};

const prism = (points: Vec3[], direction: Vec3): MeshData => {
  const n = points.length;
  if (n < 3) return { positions: [], indices: [] };
  const nd = vec3.normalize(direction);
  if (vec3.isZero(nd)) return { positions: [], indices: [] };

  const base = polyOps.orient(points, nd);
  const positions = flatten(base).concat(flatten(base.map((p) => vec3.add(p, direction))));

  const tris = triangulate.polygon(base, nd);
  if (tris.length === 0) return { positions, indices: [] };

  const indices: number[] = [];
  // Bottom cap faces -d, so reverse the +d winding.
  for (let i = 0; i < tris.length; i += 3) indices.push(tris[i], tris[i + 2], tris[i + 1]);
  // Side walls between the base and top loops.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, j, j + n, i, j + n, i + n);
  }
  // Top cap faces +d.
  for (let i = 0; i < tris.length; i += 3) {
    indices.push(tris[i] + n, tris[i + 1] + n, tris[i + 2] + n);
  }
  return { positions, indices };
};

export const extrude = { prism, walls, cap };
