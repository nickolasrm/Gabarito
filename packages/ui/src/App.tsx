import { useEffect, useReducer, useRef } from "react";
import type { ReactElement } from "react";
import type { UiApi } from "./api";
import { Labels } from "./Labels";
import { SettingsPanel } from "./SettingsPanel";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import "./styles.css";

function useUiVersion(api: UiApi): number {
  const [version, bump] = useReducer((value: number) => value + 1, 0);
  useEffect(() => api.subscribe(bump), [api]);
  return version;
}

export function App({ api }: { api: UiApi }): ReactElement {
  useUiVersion(api);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (node) api.attachViewport(node);
  }, [api]);

  return (
    <div className="app">
      <Toolbar api={api} />
      <div className="main">
        <div className="viewport" ref={viewportRef}>
          <Labels api={api} />
        </div>
        <SettingsPanel api={api} />
      </div>
      <StatusBar api={api} />
    </div>
  );
}
