import type { ReactElement } from "react";
import type { UiApi } from "./api";

/** Dimension labels and live measurements, positioned by the viewport's projection. */
export function Labels({ api }: { api: UiApi }): ReactElement {
  return (
    <div className="labels">
      {api.labels().map((label) => (
        <span key={label.id} className="label" style={{ left: label.x, top: label.y }}>
          {label.text}
        </span>
      ))}
    </div>
  );
}
