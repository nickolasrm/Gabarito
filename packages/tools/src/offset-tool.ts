import {
  EPS,
  insetContours,
  insetDistance,
  intersectPlane,
  onPlane,
} from "@gabarito/geometry";
import type { Plane, Surface, Vec3, Segment } from "@gabarito/geometry";
import { facePlane, surface, parseDimensions, UNITS } from "@gabarito/core";
import type { Store, Unit } from "@gabarito/core";
import { snapOnFace } from "./face-snap";
import type { ToolView } from "./types";

export function createOffsetTool(
  store: Store,
  view: ToolView,
  changed: () => void,
  getUnit: () => Unit,
  snapping: () => boolean,
) {
  let enabled = false,
    source: {
      id: string;
      frame: Plane;
      surface: Surface;
      revision: number;
    } | null = null,
    distance: number | null = 0,
    typed = "",
    message = "",
    lastX = 0,
    lastY = 0;
  const measurement = () =>
    distance === null
      ? ""
      : `${(distance / UNITS[getUnit()]).toFixed(2)} ${getUnit()}`;
  const clear = () => {
    source = null;
    distance = 0;
    typed = "";
    message = "";
    if (enabled) {
      view.preview([]);
      view.feedback(null);
      view.cursorHint("", lastX, lastY);
    }
  };
  const draw = (inference: Segment[] = [], label = "") => {
    if (!enabled || !source) return;
    let lines: Segment[] = [];
    if (distance !== null && distance > EPS) {
      try {
        lines = insetContours(source.surface, distance).flatMap((loop) =>
          loop.map((p, i) => [p, loop[(i + 1) % loop.length]] as Segment),
        );
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
    }
    view.preview([...lines, ...inference]);
    view.cursorHint(
      [`Offset ${measurement()}`, label].filter(Boolean).join(" · "),
      lastX,
      lastY,
    );
  };
  const finish = (value: number | null) => {
    if (!source) {
      message = "Choose a face to offset";
      changed();
      return;
    }
    if (store.getState().revision !== source.revision) {
      clear();
      message = "Source face changed; choose it again";
      changed();
      return;
    }
    if (value === null || !Number.isFinite(value) || value <= EPS) {
      message = "Enter a positive offset distance";
      changed();
      return;
    }
    try {
      store.execute({ type: "offset", face: source.id, distance: value });
      clear();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    changed();
  };
  const pointer = (x: number, y: number, click = false) => {
    lastX = x;
    lastY = y;
    let hit = view.pick(x, y, !source || !snapping());
    if (!source) {
      view.feedback(hit?.kind === "face" ? hit : null);
      if (click) {
        const f = hit ? store.getState().entities[hit.id] : null;
        if (f?.kind !== "face") {
          message = "Choose a face to offset";
          changed();
          return;
        }
        source = {
          id: f.id,
          frame: facePlane(store.getState(), f),
          surface: surface(store.getState(), f),
          revision: store.getState().revision,
        };
        distance = 0;
        typed = "";
        message = "";
        draw();
      }
      changed();
      return;
    }
    if (source.revision !== store.getState().revision) {
      clear();
      message = "Source face changed; choose it again";
      changed();
      return;
    }
    let point: Vec3 | null =
      snapping() && hit && onPlane(hit.point, source.frame)
        ? hit.point
        : intersectPlane(view.ray(x, y), source.frame);
    let lines: Segment[] = [],
      label = "";
    if (point && snapping() && (!hit || hit.kind === "face")) {
      const inferred = snapOnFace(store.getScene(), source.frame, point, view);
      if (inferred) {
        point = inferred.point;
        hit = inferred.hit;
        lines = inferred.lines;
        label = inferred.label;
      }
    }
    distance = point ? insetDistance(source.surface, point) : null;
    message = distance === null ? "Move inside the original face" : "";
    view.feedback(
      distance !== null &&
        point &&
        hit &&
        onPlane(hit.point, source.frame) &&
        snapping()
        ? hit
        : null,
    );
    draw(lines, label);
    if (click) finish(distance);
    changed();
  };
  return {
    status: () => ({
      active: !!source,
      typed,
      message,
      measurement: measurement(),
      plane: source ? "Face" : "Ground",
    }),
    enable(value: boolean) {
      if (enabled) clear();
      enabled = value;
      if (value) clear();
    },
    cancel() {
      if (enabled) clear();
    },
    refresh() {
      if (enabled && source && source.revision !== store.getState().revision) {
        clear();
        changed();
      }
    },
    redraw() {
      draw();
    },
    pointer,
    setTyped(value: string) {
      typed = value;
      changed();
    },
    submit() {
      try {
        const [value] = parseDimensions(typed, getUnit());
        finish(value);
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
        changed();
      }
    },
  };
}
