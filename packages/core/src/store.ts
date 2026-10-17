import { applyCommand, isNoop, revertCommand, type Command, type Inverse } from "./commands";
import { createDocument } from "./document";
import type { DocumentState, EntityId, Settings } from "./types";

interface UndoEntry {
  commands: Command[];
  inverses: Inverse[];
}

export interface Store {
  getState(): DocumentState;
  subscribe(listener: (state: DocumentState) => void): () => void;
  dispatch(command: Command | Command[]): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createStore(settings?: Partial<Settings>): Store {
  let state = createDocument(settings);
  const listeners = new Set<(state: DocumentState) => void>();
  const undoStack: UndoEntry[] = [];
  const redoStack: UndoEntry[] = [];

  const notify = (): void => {
    for (const listener of listeners) listener(state);
  };

  const run = (commands: Command[]): void => {
    if (commands.length === 0) return;
    const inverses = commands.map((command) => applyCommand(state, command));
    if (inverses.every(isNoop)) return;
    undoStack.push({ commands, inverses });
    redoStack.length = 0;
    state.revision += 1;
    notify();
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispatch(command) {
      run(Array.isArray(command) ? command : [command]);
    },

    undo() {
      const entry = undoStack.pop();
      if (!entry) return false;
      for (let index = entry.inverses.length - 1; index >= 0; index -= 1) {
        revertCommand(state, entry.inverses[index]);
      }
      redoStack.push(entry);
      state.revision += 1;
      notify();
      return true;
    },

    redo() {
      const entry = redoStack.pop();
      if (!entry) return false;
      const inverses = entry.commands.map((command) => applyCommand(state, command));
      undoStack.push({ commands: entry.commands, inverses });
      state.revision += 1;
      notify();
      return true;
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
}

/** Convenience helpers used by tools and the UI. */
export function selectOnly(ids: EntityId[]): Command {
  return { type: "setSelection", ids };
}

export function toggleSelection(current: EntityId[], id: EntityId): Command {
  return current.includes(id)
    ? { type: "setSelection", ids: current.filter((entry) => entry !== id) }
    : { type: "setSelection", ids: [...current, id] };
}
