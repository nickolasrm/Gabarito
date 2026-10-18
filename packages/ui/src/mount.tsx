import { createRoot } from "react-dom/client";
import { useSyncExternalStore, useEffect, useRef, useState } from "react";
import type { Store, Unit } from "@gabarito/core";
import { UNITS, vertices, edges, faces, guides } from "@gabarito/core";
import "./styles.css";
export interface ToolButton {
  id: string;
  label: string;
  key: string;
  hint: string;
}
export interface UiStatus {
  tool: string;
  active: boolean;
  typed: string;
  axis: string;
  message: string;
  unit: Unit;
  measurement: string;
  plane: string;
  snapping: boolean;
  circleSegments: number;
}
export interface UiApi {
  store: Store;
  tools: ToolButton[];
  status(): UiStatus;
  subscribe(fn: () => void): () => void;
  attach(host: HTMLElement): () => void;
  selectTool(tool: string): void;
  setUnit(unit: Unit): void;
  setCircleSegments(count: number): void;
  setTyped(text: string): void;
  submit(): void;
  undo(): void;
  redo(): void;
  remove(): void;
  frame(): void;
}
export function mountUi(root: HTMLElement, api: UiApi): () => void {
  let revision = 0;
  const subscribe = (fn: () => void) => {
    const change = () => {
      revision++;
      fn();
    };
    const a = api.subscribe(change),
      b = api.store.subscribe(change);
    return () => {
      a();
      b();
    };
  };
  function App() {
    useSyncExternalStore(subscribe, () => revision);
    const host = useRef<HTMLDivElement>(null),
      status = api.status(),
      m = api.store.getState();
    const [segmentsDraft, setSegmentsDraft] = useState(
      String(status.circleSegments),
    );
    useEffect(
      () => setSegmentsDraft(String(status.circleSegments)),
      [status.circleSegments, status.tool],
    );
    useEffect(() => api.attach(host.current!), []);
    const active = api.tools.find((t) => t.id === status.tool)!;
    return (
      <main data-tool={status.tool}>
        <header>
          <div className="brand">
            <span className="brand-mark">G</span>
            <div>
              <strong>Gabarito</strong>
              <small>Modeling workspace</small>
            </div>
          </div>
          <div className="history">
            <button onClick={api.undo} disabled={!api.store.canUndo()}>
              Undo
            </button>
            <button onClick={api.redo} disabled={!api.store.canRedo()}>
              Redo
            </button>
            <button onClick={api.frame}>
              Frame all <kbd>F</kbd>
            </button>
          </div>
          <label className="units">
            Units{" "}
            <select
              aria-label="Display and input units"
              value={status.unit}
              onChange={(e) => api.setUnit(e.target.value as Unit)}
            >
              {Object.keys(UNITS).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </header>
        <section className="workspace">
          <nav aria-label="Modeling tools">
            {api.tools.map((t) => (
              <button
                key={t.id}
                className={status.tool === t.id ? "active" : ""}
                aria-pressed={status.tool === t.id}
                onClick={() => api.selectTool(t.id)}
                title={t.hint}
              >
                <span>{t.label}</span>
                <kbd>{t.key}</kbd>
              </button>
            ))}
            <div className="tool-divider" />
            <button onClick={api.remove} disabled={!m.selection.length}>
              Delete <kbd>Del</kbd>
            </button>
          </nav>
          <div className="viewport" ref={host} />
          <aside>
            <span className="eyebrow">ACTIVE TOOL</span>
            <h1>{active.label}</h1>
            <p>{active.hint}</p>
            {status.tool === "circle" && (
              <label className="tool-option">
                Segments{" "}
                <input
                  aria-label="Circle segments"
                  type="number"
                  min="3"
                  max="256"
                  value={segmentsDraft}
                  onChange={(e) => {
                    const value = e.target.value,
                      count = Number(value);
                    setSegmentsDraft(value);
                    if (Number.isInteger(count) && count >= 3 && count <= 256)
                      api.setCircleSegments(count);
                  }}
                  onBlur={() => {
                    const count = Number(segmentsDraft);
                    if (!Number.isInteger(count) || count < 3 || count > 256) {
                      setSegmentsDraft(String(status.circleSegments));
                      api.setCircleSegments(count);
                    }
                  }}
                />
              </label>
            )}
            <div className="rule" />
            <span className="eyebrow">MODEL</span>
            <dl>
              <dt>Vertices</dt>
              <dd>{vertices(m).length}</dd>
              <dt>Edges</dt>
              <dd>{edges(m).length}</dd>
              <dt>Faces</dt>
              <dd>{faces(m).length}</dd>
              <dt>Rulers</dt>
              <dd>{guides(m).length}</dd>
              <dt>Selected</dt>
              <dd>{m.selection.length}</dd>
            </dl>
            <div className="rule" />
            <span className="eyebrow">NAVIGATION</span>
            <p>
              Middle mouse · Orbit
              <br />
              Shift + middle · Pan
              <br />
              Scroll · Zoom
            </p>
            <span className="eyebrow">AXIS LOCK</span>
            <p>
              ↑ Height · Z<br />→ Width · X<br />← Depth · Y<br />
              Press again to release
            </p>
            <p className="muted">
              Double-click selects a face and its boundary. Triple-click selects
              connected geometry. Esc cancels. Hold Alt to bypass snapping.
            </p>
          </aside>
        </section>
        <footer>
          <div className="status">
            <strong>{active.label}</strong>
            <span className="axis">{status.axis}</span>
            {!status.snapping && (
              <span className="axis">Snapping off · Alt</span>
            )}
            {(status.tool === "rectangle" ||
              status.tool === "rotate" ||
              status.tool === "circle" ||
              status.tool === "offset") && (
              <span className="axis" title="Drawing plane">
                {status.plane}
              </span>
            )}
            <span role="status" className={status.message ? "error" : ""}>
              {status.message ||
                (status.active
                  ? status.tool === "pushpull"
                    ? "Move or type a distance; click or release to finish"
                    : status.tool === "circle"
                      ? "Choose a perimeter point or enter a radius"
                      : status.tool === "offset"
                        ? "Choose the inset boundary or enter its distance"
                        : status.tool === "scale"
                          ? "Drag or click to scale; enter a positive factor"
                          : status.tool === "rotate"
                            ? "Choose B, then rotate and click; or enter degrees"
                            : "Choose destination or enter dimensions"
                  : status.tool === "pushpull"
                    ? "Click or drag a face to start"
                    : status.tool === "circle"
                      ? "Choose a perimeter point or enter a radius"
                      : status.tool === "offset"
                        ? "Choose the inset boundary or enter its distance"
                        : status.tool === "scale"
                          ? "Drag a scale handle"
                          : "Choose a starting point")}
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              api.submit();
            }}
          >
            <label htmlFor="dimensions">
              {status.tool === "rotate"
                ? "Angle"
                : status.tool === "scale"
                  ? "Factor"
                  : status.tool === "circle"
                    ? "Radius"
                    : status.tool === "offset"
                      ? "Offset"
                      : "Dimensions"}
            </label>
            <input
              id="dimensions"
              className="typed-input"
              autoComplete="off"
              spellCheck={false}
              value={status.typed}
              placeholder={
                status.measurement ||
                (status.tool === "rectangle"
                  ? "100,100"
                  : status.tool === "scale"
                    ? "1"
                    : "10")
              }
              onChange={(e) => api.setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.blur();
                }
              }}
            />
            <span>
              {status.tool === "rotate"
                ? "deg"
                : status.tool === "scale"
                  ? "×"
                  : status.unit}
            </span>
          </form>
        </footer>
      </main>
    );
  }
  const mounted = createRoot(root);
  mounted.render(<App />);
  return () => mounted.unmount();
}
