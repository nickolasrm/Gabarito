import type { ReactElement } from "react";
import type { UiApi } from "./api";

export function Toolbar({ api }: { api: UiApi }): ReactElement {
  const status = api.status();
  return (
    <header className="toolbar">
      <span className="brand">
        Gabarito <span className="brand-sub">modeler</span>
      </span>

      <div className="tools">
        {api.tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={tool.active ? "tool active" : "tool"}
            onClick={() => api.selectTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <span className="tool-label">{tool.label}</span>
            <span className="tool-key">{tool.shortcut}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <button type="button" onClick={api.undo} disabled={!status.undoable} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button type="button" onClick={api.redo} disabled={!status.redoable} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
        <button type="button" onClick={api.deleteSelection} disabled={!status.canDelete} title="Delete selection">
          Delete
        </button>
        <button type="button" onClick={api.frameAll} title="Frame the model (Home)">
          Frame
        </button>
      </div>
    </header>
  );
}
