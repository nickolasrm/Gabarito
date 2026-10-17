import type { ReactElement } from "react";
import { UNITS, UNIT_IDS } from "@gabarito/core";
import type { UiApi } from "./api";

export function SettingsPanel({ api }: { api: UiApi }): ReactElement {
  const { settings } = api.store.getState();

  return (
    <aside className="sidebar">
      <section>
        <h2>Units</h2>
        <label className="field">
          <span>Display and input</span>
          <select value={settings.unit} onChange={(event) => api.setUnit(event.target.value)}>
            {UNIT_IDS.map((id) => (
              <option key={id} value={id}>
                {UNITS[id].label} ({UNITS[id].suffix})
              </option>
            ))}
          </select>
        </label>
        <p className="note">
          Typed values use this unit. A suffix always wins: `5m` is five metres even in millimetres.
        </p>
      </section>

      <section>
        <h2>Snapping</h2>
        <label className="field checkbox">
          <input
            type="checkbox"
            checked={settings.snapping}
            onChange={(event) => api.setSnapping(event.target.checked)}
          />
          <span>Snap to geometry</span>
        </label>
        <p className="note">
          Endpoints, midpoints, edges, guides and their intersections. Turning this off keeps axis
          locks working.
        </p>
      </section>

      <section>
        <h2>Circles</h2>
        <label className="field">
          <span>Segments</span>
          <input
            type="number"
            min={3}
            max={256}
            value={settings.circleSegments}
            onChange={(event) => api.setCircleSegments(Number(event.target.value))}
          />
        </label>
        <p className="note">Curves are tessellated at creation time (decision 0013).</p>
      </section>

      <section>
        <h2>Keys</h2>
        <ul className="keys">
          <li>
            <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> pin Y, X, Z
          </li>
          <li>
            <kbd>↓</kbd> clear lock / invert
          </li>
          <li>
            <kbd>Shift</kbd>+<kbd>↑</kbd> flip sign
          </li>
          <li>
            <kbd>Enter</kbd> commit typed value
          </li>
          <li>
            <kbd>Esc</kbd> cancel
          </li>
          <li>
            <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
          </li>
        </ul>
      </section>

      <section>
        <h2>Camera</h2>
        <ul className="keys">
          <li>Middle drag — orbit</li>
          <li>Shift + middle — pan</li>
          <li>Wheel — zoom</li>
          <li>
            <kbd>Home</kbd> — frame model
          </li>
        </ul>
      </section>
    </aside>
  );
}
