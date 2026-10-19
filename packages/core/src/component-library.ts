import type { Model } from "./model";
import type { GeometryScope } from "./components";

/** Scene reachability, not a count of references inside potentially unused definitions. */
export function unusedComponents(m: Model): string[] {
  const used = new Set<string>();
  const visit = (scope: GeometryScope) => {
    for (const e of Object.values(scope.entities))
      if (e.kind === "component" && !used.has(e.definition)) {
        used.add(e.definition);
        const d = m.definitions[e.definition];
        if (d) visit(d.geometry);
      }
  };
  visit(m);
  return Object.keys(m.definitions).filter((id) => !used.has(id));
}
export function deleteComponent(m: Model, definition: string): void {
  if (!m.definitions[definition])
    throw new Error("Missing component definition");
  for (const scope of [
    m,
    ...Object.values(m.definitions).map((d) => d.geometry),
  ])
    for (const e of Object.values(scope.entities))
      if (e.kind === "component" && e.definition === definition)
        delete scope.entities[e.id];
  delete m.definitions[definition];
  m.selection = [];
}
