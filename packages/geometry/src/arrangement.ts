import {
  EPS,
  add,
  sub,
  mul,
  dot,
  cross,
  length,
  near,
  project,
  area2,
  inside,
} from "./math";
import type { Vec3, Plane } from "./math";
export type Segment = [Vec3, Vec3];
export interface Region {
  outer: number[];
  holes: number[][];
}

/** Split crossings, collinear overlaps and T-junctions before any boundary walk. */
export function splitSegments(segments: Segment[]): {
  points: Vec3[];
  edges: [number, number][];
} {
  const cuts = segments.map(() => [0, 1]);
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const [a, b] = segments[i],
        [c, d] = segments[j],
        u = sub(b, a),
        v = sub(d, c),
        w = sub(c, a);
      const n = cross(u, v),
        n2 = dot(n, n);
      if (n2 > EPS * EPS * dot(u, u) * dot(v, v)) {
        const t = dot(cross(w, v), n) / n2,
          s = dot(cross(w, u), n) / n2;
        if (
          t >= 0 &&
          t <= 1 &&
          s >= 0 &&
          s <= 1 &&
          near(add(a, mul(u, t)), add(c, mul(v, s)))
        ) {
          cuts[i].push(t);
          cuts[j].push(s);
        }
      } else if (length(cross(w, u)) < EPS * length(u)) {
        for (const p of [c, d]) {
          const t = dot(sub(p, a), u) / dot(u, u);
          if (t > 0 && t < 1) cuts[i].push(t);
        }
        for (const p of [a, b]) {
          const t = dot(sub(p, c), v) / dot(v, v);
          if (t > 0 && t < 1) cuts[j].push(t);
        }
      }
    }
  const points: Vec3[] = [],
    edges: [number, number][] = [],
    keys = new Set<string>();
  const weld = (p: Vec3): number => {
    const i = points.findIndex((q) => near(p, q));
    return i >= 0 ? i : points.push(p) - 1;
  };
  segments.forEach(([a, b], i) => {
    const ts = [...new Set(cuts[i])].sort((a, b) => a - b);
    for (let k = 1; k < ts.length; k++) {
      const x = weld(add(a, mul(sub(b, a), ts[k - 1]))),
        y = weld(add(a, mul(sub(b, a), ts[k])));
      if (x === y) continue;
      const key = [x, y].sort((a, b) => a - b).join(":");
      if (!keys.has(key)) {
        keys.add(key);
        edges.push([x, y]);
      }
    }
  });
  return { points, edges };
}

/** Left-face half-edge walk. Positive cycles are bounded planar cells. */
export function regions(
  points: Vec3[],
  edges: [number, number][],
  f: Plane,
): Region[] {
  const xy = points.map((p) => project(p, f));
  const adjacent = new Map<number, number[]>();
  for (const [a, b] of edges) {
    adjacent.set(a, [...(adjacent.get(a) ?? []), b]);
    adjacent.set(b, [...(adjacent.get(b) ?? []), a]);
  }
  for (const [a, list] of adjacent)
    list.sort(
      (b, c) =>
        Math.atan2(xy[b][1] - xy[a][1], xy[b][0] - xy[a][0]) -
        Math.atan2(xy[c][1] - xy[a][1], xy[c][0] - xy[a][0]),
    );
  const seen = new Set<string>(),
    loops: number[][] = [];
  for (const [start, list] of adjacent)
    for (const next of list) {
      if (seen.has(`${start}:${next}`)) continue;
      const loop: number[] = [];
      let a = start,
        b = next;
      do {
        const key = `${a}:${b}`;
        if (seen.has(key)) break;
        seen.add(key);
        loop.push(a);
        const around = adjacent.get(b)!;
        const c =
          around[(around.indexOf(a) + around.length - 1) % around.length];
        a = b;
        b = c;
      } while (a !== start || b !== next);
      // A dangling edge is traversed in both directions and contributes no cell boundary.
      let changed = true;
      while (changed && loop.length >= 3) {
        changed = false;
        for (let i = 0; i < loop.length; i++)
          if (
            loop[(i + loop.length - 1) % loop.length] ===
            loop[(i + 1) % loop.length]
          ) {
            const back = (i + 1) % loop.length;
            loop.splice(Math.max(i, back), 1);
            loop.splice(Math.min(i, back), 1);
            changed = true;
            break;
          }
      }
      if (
        loop.length >= 3 &&
        new Set(loop).size === loop.length &&
        area2(loop.map((i) => xy[i])) > EPS * EPS
      )
        loops.push(loop);
    }
  const areas = loops.map((loop) => area2(loop.map((i) => xy[i])));
  const parents = loops.map((loop, i) => {
    const candidates = loops
      .map((outer, j) => ({
        j,
        area: areas[j],
        contains:
          j !== i &&
          areas[j] > areas[i] + EPS * EPS &&
          loop.every((k) =>
            inside(
              xy[k],
              outer.map((k) => xy[k]),
              false,
            ),
          ),
      }))
      .filter((x) => x.contains)
      .sort((a, b) => a.area - b.area);
    return candidates[0]?.j ?? -1;
  });
  return loops.map((outer, i) => ({
    outer,
    holes: loops
      .filter((_, j) => parents[j] === i)
      .map((l) => [...l].reverse()),
  }));
}
