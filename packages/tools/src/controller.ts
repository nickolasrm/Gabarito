import {
  V,
  EPS,
  add,
  sub,
  mul,
  dot,
  cross,
  length,
  unit,
  normal,
  plane,
  project,
  intersectPlane,
  axisPoint,
  axisVector,
  rotate,
  near,
} from "@gabarito/geometry";
import type { Vec3, Axis, Segment } from "@gabarito/geometry";
import {
  parseDimensions,
  position,
  faces,
  edges,
  loops,
  facePlane,
  selectedVertices,
} from "@gabarito/core";
import type { Store, Unit, Command } from "@gabarito/core";
import { selectionAt } from "./selection";
import { TOOLS } from "./types";
import type { Tool, ToolView, Controller } from "./types";
export function createController(store: Store, view: ToolView): Controller {
  let tool: Tool = "select",
    start: Vec3 | null = null,
    first: Vec3 | null = null,
    current = V(),
    drawingPlane = plane(V(), V(0, 0, 1));
  let reference: Vec3 | null = null,
    faceId = "",
    axis: Axis | null = null,
    axisSign = 1,
    typed = "",
    message = "",
    measurement = "",
    unitId: Unit = "mm";
  let lastX = 0,
    lastY = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const fn of listeners) fn();
  };
  const cancel = () => {
    start = null;
    first = null;
    reference = null;
    faceId = "";
    typed = "";
    message = "";
    measurement = "";
    view.preview([]);
    view.feedback(null);
    emit();
  };
  const direction = (): Vec3 =>
    axis
      ? mul(axisVector(axis), axisSign)
      : tool === "pushpull"
        ? normal(
            faces(store.getState())
              .find((f) => f.id === faceId)!
              .outer.map((id) => position(store.getState(), id)),
          )
        : unit(sub(current, start ?? V()));
  const run = (c: Command): boolean => {
    try {
      store.execute(c);
      message = "";
      return true;
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
      emit();
      return false;
    }
  };
  const rectangle = (end: Vec3): Vec3[] => {
    const [x, y] = project(end, { ...drawingPlane, origin: start! });
    return [
      start!,
      add(start!, mul(drawingPlane.u, x)),
      end,
      add(start!, mul(drawingPlane.v, y)),
    ];
  };
  const polygonSegments = (ps: Vec3[]): Segment[] =>
    ps.map((p, i) => [p, ps[(i + 1) % ps.length]]);
  const rotatedAngle = (p: Vec3): number => {
    const n = axis ? mul(axisVector(axis), axisSign) : drawingPlane.normal;
    const a = unit(sub(reference ?? add(start!, drawingPlane.u), start!)),
      b = unit(sub(p, start!));
    return Math.atan2(dot(n, cross(a, b)), dot(a, b));
  };
  const updatePreview = () => {
    if (!start) {
      view.preview([]);
      return;
    }
    if (tool === "line") view.preview([[start, current]]);
    else if (tool === "rectangle")
      view.preview(polygonSegments(rectangle(current)));
    else if (tool === "pushpull") {
      const f = faces(store.getState()).find((f) => f.id === faceId);
      if (!f) return;
      const d = mul(direction(), dot(sub(current, start), direction()));
      view.preview(
        loops(f).flatMap((l) =>
          l.flatMap((id, i) => {
            const a = position(store.getState(), id),
              b = position(store.getState(), l[(i + 1) % l.length]);
            return [
              [add(a, d), add(b, d)],
              [a, add(a, d)],
            ] as Segment[];
          }),
        ),
      );
    } else if (tool === "move" || tool === "rotate") {
      const m = store.getState(),
        selected = selectedVertices(m, m.selection),
        delta = sub(current, start),
        angle = rotatedAngle(current);
      const transform = (p: Vec3) =>
        tool === "move"
          ? add(p, delta)
          : rotate(
              p,
              start!,
              axis ? mul(axisVector(axis), axisSign) : drawingPlane.normal,
              angle,
            );
      view.preview(
        edges(m)
          .filter((e) => e.vertices.some((id) => selected.has(id)))
          .map(
            (e) =>
              e.vertices.map((id) =>
                selected.has(id) ? transform(position(m, id)) : position(m, id),
              ) as Segment,
          ),
      );
    }
    const distance = length(sub(current, start));
    measurement =
      tool === "rotate"
        ? `${((rotatedAngle(current) * 180) / Math.PI).toFixed(1)}°`
        : `${distance.toFixed(2)} mm`;
  };
  const finish = (end: Vec3, number?: number): boolean => {
    if (!start) return false;
    if (tool === "line") {
      const before = faces(store.getState()).length;
      if (!run({ type: "draw", segments: [[start, end]] })) return false;
      if (
        faces(store.getState()).length > before ||
        length(sub(end, first!)) < EPS
      )
        cancel();
      else {
        start = end;
        current = end;
        typed = "";
        view.preview([]);
        emit();
      }
      return true;
    }
    let command: Command;
    if (tool === "rectangle")
      command = { type: "draw", segments: polygonSegments(rectangle(end)) };
    else if (tool === "move")
      command = {
        type: "move",
        ids: store.getState().selection,
        delta: sub(end, start),
      };
    else if (tool === "rotate")
      command = {
        type: "rotate",
        ids: store.getState().selection,
        center: start,
        axis: axis ? mul(axisVector(axis), axisSign) : drawingPlane.normal,
        angle: number ?? rotatedAngle(end),
      };
    else if (tool === "pushpull")
      command = {
        type: "pushpull",
        face: faceId,
        distance: number ?? dot(sub(end, start), direction()),
        direction: direction(),
      };
    else return false;
    if (!run(command)) return false;
    cancel();
    return true;
  };
  const submit = () => {
    if (!start) {
      message = "Click a starting point first";
      emit();
      return;
    }
    try {
      if (tool === "rectangle") {
        const [width, depth] = parseDimensions(typed, unitId, 2);
        if (width <= 0 || depth <= 0)
          throw new Error("Rectangle dimensions must be positive");
        const [x, y] = project(current, { ...drawingPlane, origin: start });
        finish(
          add(
            start,
            add(
              mul(drawingPlane.u, width * (x < 0 ? -1 : 1)),
              mul(drawingPlane.v, depth * (y < 0 ? -1 : 1)),
            ),
          ),
        );
      } else if (tool === "rotate") {
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(typed.trim()))
          throw new Error("Enter an angle in degrees");
        const angle = (Number(typed) * Math.PI) / 180;
        if (!Number.isFinite(angle)) throw new Error("Enter a finite angle");
        finish(current, angle);
      } else {
        const [distance] = parseDimensions(typed, unitId);
        let d = direction();
        if (length(d) < EPS) d = drawingPlane.u;
        finish(
          add(start, mul(d, distance)),
          tool === "pushpull" ? distance : undefined,
        );
      }
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
      emit();
    }
  };
  const pointer = (
    x: number,
    y: number,
    click = false,
    shift = false,
    clicks = 1,
  ) => {
    lastX = x;
    lastY = y;
    const ray = view.ray(x, y),
      hit = view.pick(x, y, tool === "pushpull");
    if (!start) {
      const aimed =
        hit?.kind === "face" ? store.getState().entities[hit.id] : null;
      drawingPlane =
        aimed?.kind === "face"
          ? facePlane(store.getState(), aimed)
          : plane(V(), V(0, 0, 1));
      if (axis && tool === "rectangle")
        drawingPlane = plane(V(), axis === "z" ? V(0, -1, 0) : V(0, 0, 1));
    }
    let end =
      hit && hit.kind !== "face"
        ? hit.point
        : intersectPlane(ray, drawingPlane);
    if (start && axis && tool !== "rectangle" && tool !== "rotate")
      end = axisPoint(ray, start, mul(axisVector(axis), axisSign));
    else if (start && tool === "pushpull")
      end = axisPoint(ray, start, direction());
    if (start && tool === "rotate") {
      const rotationPlane = plane(
        start,
        axis ? mul(axisVector(axis), axisSign) : drawingPlane.normal,
      );
      end = intersectPlane(ray, rotationPlane);
    }
    if (!end) {
      view.feedback(null);
      return;
    }
    if (start && !axis && tool === "line" && hit?.kind !== "vertex") {
      for (const a of ["x", "y", "z"] as Axis[]) {
        const p = axisPoint(ray, start, axisVector(a)),
          s = view.project(p);
        if (
          s.visible &&
          Math.hypot(s.x - x, s.y - y) < 6 &&
          length(sub(p, start)) > EPS
        ) {
          end = p;
          break;
        }
      }
    }
    current = end;
    view.feedback(
      hit && (!start || (tool !== "pushpull" && near(end, hit.point)))
        ? hit
        : null,
    );
    if (click) {
      message = "";
      if (tool === "select") {
        const old = store.getState().selection;
        const targets = hit
          ? selectionAt(store.getState(), hit.id, clicks)
          : [];
        store.select(
          shift && hit
            ? clicks === 1 && old.includes(hit.id)
              ? old.filter((id) => id !== hit.id)
              : [...old, ...targets]
            : targets,
        );
      } else if (!start) {
        if (tool === "pushpull" && hit?.kind !== "face") {
          message = "Choose a face";
          emit();
          return;
        }
        if (
          (tool === "move" || tool === "rotate") &&
          !store.getState().selection.length
        ) {
          if (hit) store.select([hit.id]);
          else {
            message = "Select geometry first";
            emit();
            return;
          }
        }
        start = end;
        first = end;
        reference = null;
        drawingPlane = { ...drawingPlane, origin: end };
        if (tool === "pushpull") {
          faceId = hit!.id;
          start = hit!.point;
          current = start;
        }
      } else if (tool === "rotate" && !reference) {
        if (length(sub(end, start)) > EPS) reference = end;
      } else finish(end);
    }
    updatePreview();
    emit();
  };
  return {
    status: () => ({
      tool,
      active: !!start,
      typed,
      axis: axis ? `${axis.toUpperCase()}${axisSign < 0 ? " −" : ""}` : "Free",
      message,
      unit: unitId,
      measurement,
    }),
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setTool(t) {
      cancel();
      tool = t;
      axis = null;
      axisSign = 1;
      emit();
    },
    setUnit(u) {
      unitId = u;
      emit();
    },
    setTyped(s) {
      typed = s;
      emit();
    },
    submit,
    pointer,
    press(x, y) {
      if (tool !== "pushpull") return;
      cancel();
      pointer(x, y, true);
    },
    release(x, y) {
      if (tool !== "pushpull" || !start) return;
      pointer(x, y);
      if (typed) submit();
      else if (length(sub(current, start)) <= EPS) cancel();
      else finish(current);
      // Release always ends the gesture, including invalid input or a refused operation.
      if (start) {
        const error = message;
        cancel();
        message = error;
        emit();
      }
    },
    leave() {
      view.feedback(null);
    },
    cancel,
    key(key, ctrl = false, shift = false) {
      if (ctrl && (key.toLowerCase() === "z" || key.toLowerCase() === "y")) {
        cancel();
        if (key.toLowerCase() === "y" || shift) store.redo();
        else store.undo();
        return true;
      }
      if (key === "Escape") {
        if (start) cancel();
        else {
          tool = "select";
          axis = null;
          emit();
        }
        return true;
      }
      if (key === "Enter") {
        submit();
        return true;
      }
      if (key === "Delete" || (key === "Backspace" && !typed)) {
        if (!start) run({ type: "delete", ids: store.getState().selection });
        return true;
      }
      if (key === "Backspace") {
        typed = typed.slice(0, -1);
        emit();
        return true;
      }
      const mapping: Record<string, Axis> = {
        ArrowUp: "z",
        ArrowDown: "z",
        ArrowRight: "x",
        ArrowLeft: "y",
      };
      if (mapping[key]) {
        const next = mapping[key],
          sign = key === "ArrowDown" ? -1 : 1;
        axis = axis === next && axisSign === sign ? null : next;
        axisSign = sign;
        pointer(lastX, lastY);
        emit();
        return true;
      }
      if (
        start &&
        (/^[0-9.,;+\-]$/.test(key) || (typed && /^[a-z]$/i.test(key)))
      ) {
        typed += key;
        emit();
        return true;
      }
      if (!ctrl) {
        const next = TOOLS.find(
          (t) =>
            t.key.toLowerCase() === key.toLowerCase() ||
            (key === " " && t.id === "select"),
        );
        if (next) {
          cancel();
          tool = next.id;
          axis = null;
          emit();
          return true;
        }
      }
      return false;
    },
  };
}
