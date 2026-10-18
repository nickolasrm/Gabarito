import { createModel, validate } from "./model";
import type { Model } from "./model";
import { apply } from "./edit";
import type { Command } from "./edit";
export type { Command } from "./edit";
export { isClosed } from "./edit";
export interface Store {
  getState(): Model;
  subscribe(listener: () => void): () => void;
  execute(command: Command): void;
  select(ids: string[]): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}
export function createStore(): Store {
  let state = createModel(),
    nextId = 1;
  const history: { before: Model; after: Model }[] = [],
    future: typeof history = [];
  const listeners = new Set<() => void>();
  const publish = (model: Model) => {
    model.revision = state.revision + 1;
    model.nextId = Math.max(model.nextId, nextId);
    nextId = model.nextId;
    state = model;
    for (const fn of listeners) fn();
  };
  return {
    getState: () => state,
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
      if (JSON.stringify(next.entities) === JSON.stringify(state.entities))
        return;
      history.push({
        before: structuredClone(state),
        after: structuredClone(next),
      });
      future.length = 0;
      publish(next);
    },
    select(ids) {
      publish({
        ...state,
        selection: [...new Set(ids)].filter((id) => !!state.entities[id]),
      });
    },
    undo() {
      const h = history.pop();
      if (h) {
        future.push(h);
        publish(structuredClone(h.before));
      }
    },
    redo() {
      const h = future.pop();
      if (h) {
        history.push(h);
        publish(structuredClone(h.after));
      }
    },
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0,
  };
}
