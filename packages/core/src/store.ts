import { createModel, validate } from "./model";
import type { Model } from "./model";
import { apply } from "./edit";
import type { Command } from "./edit";
import {
  identity,
  compose,
  inverseTransform,
  mapScope,
  expandModel,
  validateComponents,
} from "./components";
import type { GeometryScope, SceneModel } from "./components";
export type { Command } from "./edit";
export { isClosed } from "./edit";
export interface Store {
  getState(): Model;
  getScene(): SceneModel;
  getContext(): { path: string[]; names: string[] };
  selectionTarget(id: string): string | null;
  enterComponent(id: string): void;
  exitComponent(): void;
  subscribe(listener: () => void): () => void;
  execute(command: Command): void;
  select(ids: string[]): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}
export function createStore(): Store {
  let documentModel = createModel(),
    path: string[] = [],
    nextId = 1;
  let state: Model = documentModel,
    scene: SceneModel = expandModel(documentModel);
  const history: { before: Model; after: Model; path: string[] }[] = [],
    future: typeof history = [];
  const listeners = new Set<() => void>();
  const scopeAt = (doc: Model, context: string[]) => {
    let scope: GeometryScope = doc,
      transform = identity();
    const names: string[] = [];
    for (const id of context) {
      const e = scope.entities[id];
      if (e?.kind !== "component" || !doc.definitions[e.definition])
        throw new Error("Missing component context");
      transform = compose(transform, e.transform);
      const d = doc.definitions[e.definition];
      names.push(d.name);
      scope = d.geometry;
    }
    return { scope, transform, names };
  };
  const refresh = () => {
    const { scope, transform } = scopeAt(documentModel, path);
    state = { ...documentModel, ...mapScope(scope, transform) };
    scene = expandModel(documentModel, path);
    scene.selection = Object.keys(scene.entities).filter((id) =>
      state.selection.includes(scene.owners[id] ?? ""),
    );
  };
  const publish = (doc: Model, context = path) => {
    doc.revision = documentModel.revision + 1;
    doc.nextId = Math.max(doc.nextId, nextId);
    nextId = doc.nextId;
    documentModel = doc;
    path = [...context];
    refresh();
    for (const fn of listeners) fn();
  };
  return {
    getState: () => state,
    getScene: () => scene,
    getContext: () => ({
      path: [...path],
      names: scopeAt(documentModel, path).names,
    }),
    selectionTarget: (id) =>
      scene.owners[id] ?? (state.entities[id] ? id : null),
    enterComponent(id) {
      if (state.entities[id]?.kind !== "component") return;
      publish({ ...documentModel, selection: [] }, [...path, id]);
    },
    exitComponent() {
      if (path.length)
        publish(
          { ...documentModel, selection: [path[path.length - 1]] },
          path.slice(0, -1),
        );
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    execute(command) {
      const next = structuredClone(state);
      apply(next, command);
      validate(next);
      const doc = structuredClone(documentModel);
      doc.definitions = next.definitions;
      const { scope, transform } = scopeAt(doc, path),
        local = mapScope(next, inverseTransform(transform));
      scope.entities = local.entities;
      scope.erased = local.erased;
      doc.nextId = next.nextId;
      doc.selection = next.selection;
      validateComponents(doc);
      for (const d of Object.values(doc.definitions))
        validate({ ...createModel(), ...d.geometry });
      const content = (m: Model) =>
        JSON.stringify([m.entities, m.definitions, m.erased]);
      if (content(doc) === content(documentModel)) return;
      history.push({
        before: structuredClone(documentModel),
        after: structuredClone(doc),
        path: [...path],
      });
      future.length = 0;
      publish(doc);
    },
    select(ids) {
      publish({
        ...documentModel,
        selection: [...new Set(ids)].filter((id) => !!state.entities[id]),
      });
    },
    undo() {
      const h = history.pop();
      if (h) {
        future.push(h);
        publish(structuredClone(h.before), h.path);
      }
    },
    redo() {
      const h = future.pop();
      if (h) {
        history.push(h);
        publish(structuredClone(h.after), h.path);
      }
    },
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0,
  };
}
