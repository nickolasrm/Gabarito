import {
  closestOnSegment,
  dot,
  mergeCoplanar,
  near,
  normal,
  planeKey,
} from "@gabarito/geometry";
import type { Surface } from "@gabarito/geometry";
import {
  addSurface,
  conformEdges,
  edgeKey,
  edges,
  facePlane,
  faces,
  loops,
  position,
  surface,
} from "./model";
import type { Face, Model } from "./model";

export function erase(m: Model, ids: string[]): void {
  const remove = new Set(ids),
    deleted = edges(m).filter(
      (e) => remove.has(e.id) || e.vertices.some((id) => remove.has(id)),
    ),
    deletedKeys = new Set(deleted.map((e) => edgeKey(...e.vertices))),
    boundaries = (f: Face) =>
      loops(f).flatMap((l) =>
        l.map((a, i) => edgeKey(a, l[(i + 1) % l.length])),
      ),
    eligible = faces(m).filter(
      (f) =>
        !remove.has(f.id) &&
        !loops(f)
          .flat()
          .some((id) => remove.has(id)),
    ),
    neighbors = new Map<Face, Set<Face>>();
  for (const key of deletedKeys) {
    const groups = new Map<string, Face[]>();
    for (const f of eligible.filter((f) => boundaries(f).includes(key))) {
      const plane = planeKey(facePlane(m, f));
      groups.set(plane, [...(groups.get(plane) ?? []), f]);
    }
    for (const group of groups.values())
      for (const f of group) {
        const adjacent = neighbors.get(f) ?? new Set<Face>();
        group
          .filter((other) => other !== f)
          .forEach((other) => adjacent.add(other));
        neighbors.set(f, adjacent);
      }
  }
  const seen = new Set<Face>(),
    merged = new Set<string>(),
    replacements: Surface[] = [];
  for (const seed of neighbors.keys()) {
    if (seen.has(seed)) continue;
    const group = [seed];
    seen.add(seed);
    for (let i = 0; i < group.length; i++)
      for (const next of neighbors.get(group[i]) ?? [])
        if (!seen.has(next)) {
          seen.add(next);
          group.push(next);
        }
    if (group.length < 2) continue;
    const n = normal(surface(m, seed).outer);
    const patches = mergeCoplanar(
      group.map((f) => {
        const patch = surface(m, f);
        // Erasing a divider unions coverage regardless of the faces' winding.
        if (dot(normal(patch.outer), n) < 0) {
          patch.outer.reverse();
          patch.holes.forEach((l) => l.reverse());
        }
        return patch;
      }),
    );
    // A mixed selection that also erases a perimeter must not recreate that edge.
    if (
      patches.some((patch) =>
        [patch.outer, ...patch.holes].some((l) =>
          l.some((a, i) =>
            deleted.some((e) =>
              e.vertices.every((id) => {
                const p = position(m, id);
                return near(p, closestOnSegment(p, a, l[(i + 1) % l.length]));
              }),
            ),
          ),
        ),
      )
    )
      continue;
    group.forEach((f) => merged.add(f.id));
    replacements.push(...patches);
  }
  deleted.forEach((e) => remove.add(e.id));
  for (const f of faces(m))
    if (
      remove.has(f.id) ||
      merged.has(f.id) ||
      loops(f)
        .flat()
        .some((id) => remove.has(id)) ||
      boundaries(f).some((key) => deletedKeys.has(key))
    ) {
      if (!merged.has(f.id))
        m.erased.push({
          outer: [...f.outer],
          holes: f.holes.map((l) => [...l]),
        });
      remove.add(f.id);
    }
  for (const id of remove) delete m.entities[id];
  replacements.forEach((patch) => addSurface(m, patch));
  if (replacements.length) conformEdges(m);
  m.selection = [];
}
