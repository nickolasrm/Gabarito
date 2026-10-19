import { unusedComponents } from "./component-library";
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
  getUnusedComponents(): string[];
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
    scene: SceneModel = expandModel(documentModel),
    unused: string[] = [];
  const history: {
      before: Model;
      after: Model;
      beforePath: string[];
      afterPath: string[];
    }[] = [],
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
    unused = unusedComponents(documentModel);
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
    getUnusedComponents: () => [...unused],
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
      const libraryCommand =
        command.type === "delete-component" ||
        command.type === "purge-components";
      const doc = structuredClone(documentModel);
      let afterPath = [...path];
      if (libraryCommand) {
        apply(doc, command);
        while (afterPath.length) {
          try {
            scopeAt(doc, afterPath);
            break;
          } catch {
            afterPath.pop();
          }
        }
      } else {
        const next = structuredClone(state);
        apply(next, command);
        validate(next);
        doc.definitions = next.definitions;
        const { scope, transform } = scopeAt(doc, path),
          local = mapScope(next, inverseTransform(transform));
        scope.entities = local.entities;
        scope.erased = local.erased;
        doc.nextId = next.nextId;
        doc.selection = next.selection;
      }
      validate(doc);
      validateComponents(doc);
      for (const d of Object.values(doc.definitions))
        validate({ ...createModel(), ...d.geometry });
      const content = (m: Model) =>
        JSON.stringify([m.entities, m.definitions, m.erased]);
      if (content(doc) === content(documentModel)) return;
      history.push({
        before: structuredClone(documentModel),
        after: structuredClone(doc),
        beforePath: [...path],
        afterPath,
      });
      future.length = 0;
      publish(doc, afterPath);
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
        publish(structuredClone(h.before), h.beforePath);
      }
    },
    redo() {
      const h = future.pop();
      if (h) {
        history.push(h);
        publish(structuredClone(h.after), h.afterPath);
      }
    },
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0,
  };
}
