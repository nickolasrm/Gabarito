import type { ReactElement } from "react";
import type { UiApi } from "./api";

const AXIS_NAMES: Record<string, string> = { x: "X (red)", y: "Y (green)", z: "Z (blue)" };

export function StatusBar({ api }: { api: UiApi }): ReactElement {
  const status = api.status();
  return (
    <footer className="statusbar">
      <span className="status-tool">{status.toolLabel}</span>
      <span className="status-hint">{status.hint}</span>

      {status.axisKey && <span className="chip axis">Axis lock: {AXIS_NAMES[status.axisKey]}</span>}
      {status.snapLabel && <span className="chip snap">{status.snapLabel}</span>}

      <span className="spacer" />

      {status.readout && <span className="readout">{status.readout}</span>}

      {status.typed !== "" ? (
        <span className="typed">
          <input readOnly value={status.typed} className="typed-input" />
          <span className="typed-unit">{status.suffix}</span>
          <span className="typed-hint">Enter to apply</span>
        </span>
      ) : (
        status.numberHint && (
          <span className="typed-placeholder">type <b>{status.numberHint}</b> then Enter</span>
        )
      )}

      <span className="chip unit">{status.suffix}</span>
    </footer>
  );
}
