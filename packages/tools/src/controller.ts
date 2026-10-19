import { createOffsetTool } from "./offset-tool";
import { createScaleTool } from "./scale-tool";
import { snapOnFace, midpointEdge } from "./face-snap";
import { snapAlongAxis } from "./axis-snap";
import { rectangleRatio, snapProportion } from "./proportions";
import {
  V,
  EPS,
  circlePoints,
  DEFAULT_CIRCLE_SEGMENTS,
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
  onPlane,
} from "@gabarito/geometry";
import type { Vec3, Axis, Segment } from "@gabarito/geometry";
import {
  parseDimensions,
  UNITS,
  referenceLines,
  guides,
  position,
  faces,
  edges,
  loops,
  facePlane,
  selectionGeometry,
  selectedVertices,
} from "@gabarito/core";
import type { Store, Unit, Command } from "@gabarito/core";
import { inferRectanglePlane, defaultDrawingPlane } from "./drawing-plane";
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
  let circleSegments = DEFAULT_CIRCLE_SEGMENTS;
  let planeLabel = "Ground";
  let lastX = 0,
    lastY = 0;
  let snapping = true,
    inferenceLines: Segment[] = [],
    inferenceLabel = "";
  let rulerDirection: Vec3 | null = null;
  let gesturePress: { x: number; y: number; active: boolean } | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const fn of listeners) fn();
  };
  const scaleTool = createScaleTool(store, view, emit);
  const offsetTool = createOffsetTool(
    store,
    view,
    emit,
    () => unitId,
    () => snapping,
  );
  const activateToolViews = () => {
    scaleTool.enable(false);
    offsetTool.enable(false);
    if (tool === "scale") scaleTool.enable(true);
    if (tool === "offset") offsetTool.enable(true);
  };
  const unsubscribe = store.subscribe(() => {
    if (tool === "scale") scaleTool.refresh();
    if (tool === "offset") offsetTool.refresh();
  });
  const cancel = () => {
    axis = null;
    axisSign = 1;
    planeLabel = "Ground";
    gesturePress = null;
    rulerDirection = null;
    inferenceLines = [];
    inferenceLabel = "";
    start = null;
    first = null;
    reference = null;
    faceId = "";
    typed = "";
    message = "";
    measurement = "";
    view.preview([]);
    view.cursorHint("", lastX, lastY);
    view.feedback(null);
    scaleTool.cancel();
    offsetTool.cancel();
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
      add(start!, add(mul(drawingPlane.u, x), mul(drawingPlane.v, y))),
      add(start!, mul(drawingPlane.v, y)),
    ];
  };
  const polygonSegments = (ps: Vec3[]): Segment[] =>
    ps.map((p, i) => [p, ps[(i + 1) % ps.length]]);
  const rotationPlane = () =>
    axis
      ? plane(start ?? drawingPlane.origin, mul(axisVector(axis), axisSign))
      : { ...drawingPlane, origin: start ?? drawingPlane.origin };
  const rotationVector = (p: Vec3): Vec3 => {
    const d = sub(p, start!),
      n = rotationPlane().normal;
    return sub(d, mul(n, dot(d, n)));
  };
  const rotatedAngle = (p: Vec3): number => {
    if (!reference || near(p, start!)) return 0;
    const n = rotationPlane().normal,
      a = unit(rotationVector(reference)),
      b = unit(rotationVector(p));
    return Math.atan2(dot(n, cross(a, b)), dot(a, b));
  };
  const updatePreview = () => {
    if (!start) {
      view.preview(inferenceLines);
      view.cursorHint(inferenceLabel, lastX, lastY);
      return;
    }
    let ratio = "";
    if (tool === "line") view.preview([[start, current], ...inferenceLines]);
    else if (tool === "tape")
      view.preview(
        [[start, current], ...inferenceLines],
        near(start, current)
          ? []
          : [
              {
                id: "preview:ruler",
                origin: current,
                direction: unit(rulerDirection ?? sub(current, start)),
              },
            ],
      );
    else if (tool === "rectangle") {
      const corners = rectangle(current),
        [width, height] = project(current, { ...drawingPlane, origin: start });
      ratio = snapping ? rectangleRatio(width, height) : "";
      const lines = polygonSegments(corners);
      if (ratio) lines.push([start, current]);
      view.preview([...lines, ...inferenceLines]);
    } else if (tool === "circle") {
      const radius = length(sub(current, start));
      view.preview(
        radius > EPS
          ? [
              ...polygonSegments(
                circlePoints(
                  start,
                  drawingPlane,
                  radius,
                  circleSegments,
                  sub(current, start),
                ),
              ),
              [start, current],
              ...inferenceLines,
            ]
          : [],
      );
    } else if (tool === "pushpull") {
      const f = faces(store.getState()).find((f) => f.id === faceId);
      if (!f) return;
      const d = mul(direction(), dot(sub(current, start), direction()));
      view.preview(
        loops(f)
          .flatMap((l) =>
            l.flatMap((id, i) => {
              const a = position(store.getState(), id),
                b = position(store.getState(), l[(i + 1) % l.length]);
              return [
                [add(a, d), add(b, d)],
                [a, add(a, d)],
              ] as Segment[];
            }),
          )
          .concat(inferenceLines),
      );
    } else if (tool === "move" || tool === "rotate") {
      const m = selectionGeometry(store.getState()),
        selected = selectedVertices(m, m.selection),
        delta = sub(current, start),
        angle = rotatedAngle(current);
      const transform = (p: Vec3) =>
        tool === "move"
          ? add(p, delta)
          : rotate(p, start!, rotationPlane().normal, angle);
      view.preview(
        edges(m)
          .filter((e) => e.vertices.some((id) => selected.has(id)))
          .map(
            (e) =>
              e.vertices.map((id) =>
                selected.has(id) ? transform(position(m, id)) : position(m, id),
              ) as Segment,
          )
          .concat(inferenceLines)
          .concat(
            tool === "rotate"
              ? reference
                ? [
                    [start, reference],
                    [start, current],
                  ]
                : [[start, current]]
              : [],
          ),
        guides(m)
          .filter((g) => m.selection.includes(g.id))
          .map((g) => ({
            ...g,
            origin: transform(g.origin),
            direction: sub(
              transform(add(g.origin, g.direction)),
              transform(g.origin),
            ),
          })),
      );
    }
    const distance = length(sub(current, start));
    measurement =
      tool === "rotate"
        ? `${(Math.round((rotatedAngle(current) * 1800) / Math.PI) / 10).toFixed(1)}°`
        : `${(distance / UNITS[unitId]).toFixed(2)} ${unitId}`;
    view.cursorHint(
      tool === "tape" || tool === "rotate" || tool === "circle"
        ? [
            tool === "circle" ? `Radius ${measurement}` : measurement,
            inferenceLabel,
          ]
            .filter(Boolean)
            .join(" · ")
        : [
            inferenceLabel,
            ratio ||
              ((tool === "pushpull" || tool === "move") && inferenceLabel
                ? measurement
                : ""),
          ]
            .filter(Boolean)
            .join(" · "),
      lastX,
      lastY,
    );
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
        axis = null;
        axisSign = 1;
        typed = "";
        inferenceLines = [];
        inferenceLabel = "";
        view.preview([]);
        emit();
      }
      return true;
    }
    if (tool === "tape") {
      if (near(start, end)) {
        cancel();
        return true;
      }
      if (
        !run({
          type: "guide",
          origin: end,
          direction: unit(rulerDirection ?? sub(end, start)),
        })
      )
        return false;
      cancel();
      return true;
    }
    let command: Command;
    if (tool === "rectangle") {
      const corners = rectangle(end);
      if (near(corners[0], corners[1]) || near(corners[0], corners[3])) {
        message = "Choose an opposite corner with width and height";
        emit();
        return false;
      }
      command = {
        type: "draw",
        segments: polygonSegments(corners),
        fillLoop: corners,
      };
    } else if (tool === "circle") {
      try {
        const points = circlePoints(
          start,
          drawingPlane,
          number ?? length(sub(end, start)),
          circleSegments,
          sub(end, start),
        );
        command = {
          type: "draw",
          segments: polygonSegments(points),
          fillLoop: points,
        };
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
        emit();
        return false;
      }
    } else if (tool === "move")
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
        axis: rotationPlane().normal,
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
    if (tool === "scale") {
      scaleTool.submit();
      return;
    }
    if (tool === "offset") {
      offsetTool.submit();
      return;
    }
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
      } else if (tool === "circle") {
        const [radius] = parseDimensions(typed, unitId);
        finish(current, radius);
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
    if (tool === "scale") {
      scaleTool.pointer(x, y, click);
      emit();
      return;
    }
    if (tool === "offset") {
      offsetTool.pointer(x, y, click);
      emit();
      return;
    }
    inferenceLines = [];
    inferenceLabel = "";
    const ray = view.ray(x, y);
    let hit = view.pick(
      x,
      y,
      (tool === "pushpull" && !start) || (!snapping && tool !== "select"),
    );
    if (!start) {
      const aimed =
        hit?.kind === "face" ? store.getScene().entities[hit.id] : null;
      drawingPlane =
        aimed?.kind === "face"
          ? facePlane(store.getScene(), aimed)
          : plane(V(), V(0, 0, 1));
      if (axis && tool === "rectangle")
        drawingPlane = plane(V(), axis === "z" ? V(0, -1, 0) : V(0, 0, 1));
    }
    if (tool === "rectangle" || (tool === "tape" && !start)) {
      const inferred = axis
        ? {
            frame: plane(start ?? V(), axis === "z" ? V(0, -1, 0) : V(0, 0, 1)),
            label: `Axis ${axis.toUpperCase()}`,
          }
        : inferRectanglePlane(
            store.getScene(),
            hit,
            start,
            ray,
            start
              ? { frame: drawingPlane, label: planeLabel }
              : defaultDrawingPlane(hit?.point),
          );
      drawingPlane = inferred.frame;
      planeLabel = inferred.label;
      if (start) drawingPlane = { ...drawingPlane, origin: start };
    }
    if (tool === "circle") {
      if (axis) {
        drawingPlane = plane(
          start ?? hit?.point ?? V(),
          axis === "z" ? V(0, -1, 0) : V(0, 0, 1),
        );
        planeLabel = `Axis ${axis.toUpperCase()}`;
      } else if (!start) {
        const inferred = inferRectanglePlane(
          store.getScene(),
          hit,
          null,
          ray,
          defaultDrawingPlane(hit?.point),
        );
        drawingPlane = inferred.frame;
        planeLabel = inferred.label;
      }
    }
    if (tool === "rotate" && !reference) {
      const inferred = axis
        ? { frame: rotationPlane(), label: `Axis ${axis.toUpperCase()}` }
        : inferRectanglePlane(
            store.getScene(),
            hit,
            start,
            ray,
            start
              ? { frame: drawingPlane, label: planeLabel }
              : defaultDrawingPlane(hit?.point),
          );
      drawingPlane = {
        ...inferred.frame,
        origin: start ?? inferred.frame.origin,
      };
      planeLabel = inferred.label;
    }
    let end =
      hit &&
      (hit.kind !== "face" || tool === "tape" || tool === "rotate") &&
      ((tool !== "rectangle" && tool !== "circle") ||
        onPlane(hit.point, drawingPlane))
        ? hit.point
        : intersectPlane(ray, drawingPlane);
    if (
      start &&
      axis &&
      tool !== "rectangle" &&
      tool !== "rotate" &&
      tool !== "circle"
    )
      end = axisPoint(ray, start, mul(axisVector(axis), axisSign));
    else if (start && tool === "pushpull")
      end = axisPoint(ray, start, direction());
    if (start && tool === "rotate") {
      const frame = rotationPlane();
      end =
        snapping && hit && onPlane(hit.point, frame)
          ? hit.point
          : intersectPlane(ray, frame);
    }
    if (!end) {
      view.cursorHint("", x, y);
      view.feedback(null);
      return;
    }
    if (
      snapping &&
      (!axis ||
        tool === "rectangle" ||
        tool === "rotate" ||
        tool === "circle") &&
      (tool === "line" ||
        tool === "rectangle" ||
        tool === "tape" ||
        tool === "rotate" ||
        tool === "circle") &&
      (!hit || hit.kind === "face")
    ) {
      const m = store.getScene(),
        target = hit ? m.entities[hit.id] : null;
      const support =
        tool === "rotate" && start
          ? rotationPlane()
          : (tool === "tape" || tool === "rotate") && target?.kind === "face"
            ? facePlane(m, target)
            : drawingPlane;
      const inferred = snapOnFace(m, support, end, view);
      const proportion =
        start && tool === "rectangle"
          ? snapProportion(start, end, drawingPlane, view)
          : null;
      const raw = end;
      const pixels = (p: Vec3) => {
        const a = view.project(p),
          b = view.project(raw);
        return Math.hypot(a.x - b.x, a.y - b.y);
      };
      if (
        inferred &&
        (!proportion ||
          pixels(proportion) > 1e-6 ||
          pixels(inferred.point) <= 1e-6)
      ) {
        end = inferred.point;
        hit = inferred.hit;
        inferenceLines = inferred.lines;
        inferenceLabel = inferred.label;
      } else if (proportion) end = proportion;
    }
    if (
      snapping &&
      start &&
      (tool === "pushpull" || (tool === "move" && axis))
    ) {
      const target =
        tool === "move" &&
        hit &&
        store
          .getState()
          .selection.includes(store.selectionTarget(hit.id) ?? hit.id)
          ? null
          : hit;
      const inferred = snapAlongAxis(
        store.getScene(),
        start,
        end,
        direction(),
        tool === "pushpull" ? faceId : "",
        target,
        view,
      );
      if (inferred) {
        end = inferred.point;
        inferenceLines = inferred.lines;
        inferenceLabel = inferred.label;
      }
    }
    if (
      snapping &&
      !inferenceLabel &&
      start &&
      !axis &&
      (tool === "line" || tool === "tape") &&
      (!hit || (tool === "line" && hit.kind === "face"))
    ) {
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
      hit &&
        (!!inferenceLabel ||
          near(end, hit.point) ||
          (tool === "pushpull" && !start)) &&
        (snapping || tool === "select" || tool === "pushpull")
        ? hit
        : null,
    );
    if (click) {
      message = "";
      if (tool === "select") {
        const old = store.getState().selection;
        const target = hit ? store.selectionTarget(hit.id) : null;
        if (
          target &&
          clicks >= 2 &&
          store.getState().entities[target]?.kind === "component"
        ) {
          cancel();
          store.enterComponent(target);
          emit();
          return;
        }
        const targets = target
          ? selectionAt(store.getState(), target, clicks)
          : [];
        store.select(
          shift && target
            ? clicks === 1 && old.includes(target)
              ? old.filter((id) => id !== target)
              : [...old, ...targets]
            : targets,
        );
      } else if (!start) {
        if (tool === "tape") {
          if (!hit) {
            message = "Choose a vertex, edge, face or ruler";
            emit();
            return;
          }
          const m = store.getScene(),
            source = m.entities[midpointEdge(m, hit) ?? hit.id];
          rulerDirection =
            source?.kind === "edge"
              ? sub(
                  position(m, source.vertices[1]),
                  position(m, source.vertices[0]),
                )
              : hit.kind === "guide"
                ? (referenceLines(m).find((g) => g.id === hit.id)?.direction ??
                  null)
                : null;
        }
        if (
          tool === "pushpull" &&
          (hit?.kind !== "face" ||
            store.getState().entities[hit.id]?.kind !== "face")
        ) {
          message =
            "Choose a face in the active context; double-click a component to edit it";
          emit();
          return;
        }
        if (
          (tool === "move" || tool === "rotate") &&
          !store.getState().selection.length
        ) {
          if (hit) store.select([store.selectionTarget(hit.id) ?? hit.id]);
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
    dispose() {
      unsubscribe();
      scaleTool.enable(false);
      offsetTool.enable(false);
      listeners.clear();
    },
    status: () => ({
      tool,
      active: !!start,
      typed,
      axis: axis ? `${axis.toUpperCase()}${axisSign < 0 ? " −" : ""}` : "Free",
      message,
      unit: unitId,
      measurement,
      plane: planeLabel,
      snapping,
      circleSegments,
      ...(tool === "offset" ? { ...offsetTool.status(), axis: "Free" } : {}),
      ...(tool === "scale" ? { ...scaleTool.status(), axis: "Free" } : {}),
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
      activateToolViews();
      axis = null;
      axisSign = 1;
      emit();
    },
    setCircleSegments(count) {
      if (!Number.isInteger(count) || count < 3 || count > 256) {
        message = "Circle segments must be an integer from 3 to 256";
        emit();
        return;
      }
      circleSegments = count;
      message = "";
      if (tool === "circle") updatePreview();
      emit();
    },
    setUnit(u) {
      unitId = u;
      if (tool === "offset") offsetTool.redraw();
      else if (tool !== "scale") updatePreview();
      emit();
    },
    setSnapping(enabled) {
      if (snapping === enabled) return;
      snapping = enabled;
      pointer(lastX, lastY);
      emit();
    },
    setTyped(s) {
      if (tool === "offset") {
        offsetTool.setTyped(s);
        return;
      }
      if (tool === "scale") {
        scaleTool.setTyped(s);
        return;
      }
      typed = s;
      emit();
    },
    submit,
    pointer,
    press(x, y) {
      if (tool === "scale") {
        scaleTool.press(x, y);
        emit();
        return;
      }
      if (tool !== "tape" && tool !== "pushpull") return;
      gesturePress = { x, y, active: !!start };
      pointer(x, y, !start);
    },
    release(x, y) {
      if (tool === "scale") {
        scaleTool.release(x, y);
        emit();
        return;
      }
      if (tool !== "tape" && tool !== "pushpull") return;
      const pressed = gesturePress;
      gesturePress = null;
      if (!pressed || !start) return;
      pointer(x, y);
      if (
        !pressed.active &&
        !typed &&
        Math.hypot(x - pressed.x, y - pressed.y) <= 3
      )
        return;
      if (typed) submit();
      else if (length(sub(current, start)) <= EPS) cancel();
      else finish(current);
      // Release always ends a completed push/pull gesture, including invalid input or a refused operation.
      if (tool === "pushpull" && start) {
        const error = message;
        cancel();
        message = error;
        emit();
      }
    },
    leave() {
      view.cursorHint("", lastX, lastY);
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
        if (
          start ||
          (tool === "scale" && scaleTool.status().active) ||
          (tool === "offset" && offsetTool.status().active)
        )
          cancel();
        else {
          store.exitComponent();
          tool = "select";
          activateToolViews();
          axis = null;
          axisSign = 1;
          emit();
        }
        return true;
      }
      if (key === "Enter") {
        submit();
        return true;
      }
      if (
        key === "Delete" ||
        (key === "Backspace" &&
          !(tool === "scale"
            ? scaleTool.status().typed
            : tool === "offset"
              ? offsetTool.status().typed
              : typed))
      ) {
        if (
          !start &&
          !(tool === "scale" && scaleTool.status().active) &&
          !(tool === "offset" && offsetTool.status().active)
        )
          run({ type: "delete", ids: store.getState().selection });
        return true;
      }
      if (key === "Backspace") {
        if (tool === "offset") {
          offsetTool.setTyped(offsetTool.status().typed.slice(0, -1));
          return true;
        }
        if (tool === "scale") {
          scaleTool.setTyped(scaleTool.status().typed.slice(0, -1));
          return true;
        }
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
        if (tool === "scale" || tool === "offset") return true;
        const next = mapping[key],
          sign = key === "ArrowDown" ? -1 : 1;
        axis = axis === next && axisSign === sign ? null : next;
        axisSign = sign;
        if (tool === "rotate" && start && reference) {
          const d = rotationVector(reference);
          reference = length(d) > EPS ? add(start, d) : null;
        }
        pointer(lastX, lastY);
        emit();
        return true;
      }
      if (
        (start ||
          (tool === "scale" && scaleTool.status().active) ||
          (tool === "offset" && offsetTool.status().active)) &&
        (/^[0-9.,;+\-]$/.test(key) ||
          ((typed || (tool === "offset" && offsetTool.status().typed)) &&
            /^[a-z]$/i.test(key)))
      ) {
        if (tool === "offset")
          offsetTool.setTyped(offsetTool.status().typed + key);
        else if (tool === "scale")
          scaleTool.setTyped(scaleTool.status().typed + key);
        else typed += key;
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
          activateToolViews();
          axis = null;
          emit();
          return true;
        }
      }
      return false;
    },
  };
}
