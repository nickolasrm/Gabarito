import { V, scale, sub, add, unit, length } from "@gabarito/geometry";
import { edges, selectedVertices, position, guides } from "@gabarito/core";
import type { Vec3, Segment } from "@gabarito/geometry";
import type { Store } from "@gabarito/core";
import type { ToolView } from "./types";
import { scaleBox, gripFactors, transformBox } from "./scale-box";
import type { ScaleBox, ScaleGrip } from "./scale-box";

export function createScaleTool(
  store: Store,
  view: ToolView,
  changed: () => void,
) {
  let enabled = false,
    box: ScaleBox | null = null,
    grip: ScaleGrip | null = null,
    factors = V(1, 1, 1),
    typed = "",
    message = "",
    lastX = 0,
    lastY = 0,
    inputValid = true;
  let pressed: { x: number; y: number; active: boolean } | null = null;
  const valid = () =>
    Object.values(factors).every((f) => Number.isFinite(f) && f > 0);
  const measurement = () =>
    grip
      ? grip.axes
          .map((a) => `${a.toUpperCase()} ${factors[a].toPrecision(4)}×`)
          .join(" · ")
      : "";
  const draw = () => {
    if (!enabled) return;
    const m = store.getState(),
      preview =
        box && grip && valid() ? transformBox(box, grip.anchor, factors) : box;
    const lines = [...(preview?.lines ?? [])];
    if (grip && valid()) {
      const selected = selectedVertices(m, m.selection),
        transform = (p: Vec3) => scale(p, grip!.anchor, factors);
      for (const e of edges(m))
        if (e.vertices.some((id) => selected.has(id)))
          lines.push(
            e.vertices.map((id) =>
              selected.has(id) ? transform(position(m, id)) : position(m, id),
            ) as Segment,
          );
      view.preview(
        lines,
        guides(m)
          .filter((g) => m.selection.includes(g.id))
          .map((g) => {
            const origin = transform(g.origin);
            return {
              ...g,
              origin,
              direction: unit(
                sub(transform(add(g.origin, g.direction)), origin),
              ),
            };
          }),
      );
    } else view.preview(lines);
    view.handles?.(
      (preview?.grips ?? []).map((g) => ({
        id: g.id,
        point: g.point,
        label: g.label,
      })),
      grip?.id,
    );
    view.cursorHint(grip ? measurement() : "", lastX, lastY);
  };
  const reset = () => {
    inputValid = true;
    grip = null;
    pressed = null;
    factors = V(1, 1, 1);
    typed = "";
    message = "";
    box = scaleBox(store.getState());
    draw();
  };
  const finish = () => {
    if (!grip) return;
    if (!inputValid) {
      message = "Orbit the view to reach this scale handle plane";
      changed();
      return;
    }
    if (!valid()) {
      message =
        "Scale factors must be positive; crossing the anchor is not supported";
      changed();
      return;
    }
    const anchor = grip.anchor;
    try {
      store.execute({
        type: "scale",
        ids: store.getState().selection,
        anchor,
        factors,
      });
      reset();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    changed();
  };
  const submit = () => {
    if (!grip) {
      message = "Choose a scale handle first";
      changed();
      return;
    }
    if (
      !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(typed.trim()) ||
      !Number.isFinite(Number(typed)) ||
      Number(typed) <= 0
    ) {
      message = "Enter a finite positive scale factor";
      changed();
      return;
    }
    inputValid = true;
    factors = V(1, 1, 1);
    for (const a of grip.axes) factors[a] = Number(typed);
    finish();
  };
  const pointer = (x: number, y: number, click = false) => {
    lastX = x;
    lastY = y;
    if (grip) {
      const next = gripFactors(grip, view.ray(x, y));
      inputValid = !!next;
      if (next) factors = next;
      message = !inputValid
        ? "Orbit the view to reach this scale handle plane"
        : valid()
          ? ""
          : "Scale factors must stay positive";
      draw();
      if (click) finish();
      return;
    }
    box = scaleBox(store.getState());
    const target = (box?.grips ?? [])
      .map((g) => ({ g, p: view.project(g.point) }))
      .filter(
        ({ g, p }) =>
          p.visible &&
          view.visible(g.point) &&
          Math.hypot(p.x - x, p.y - y) <= 9,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.p.x - x, a.p.y - y) - Math.hypot(b.p.x - x, b.p.y - y) ||
          length(sub(a.g.point, view.ray(x, y).origin)) -
            length(sub(b.g.point, view.ray(x, y).origin)),
      )[0]?.g;
    if (click && target) {
      grip = target;
      factors = V(1, 1, 1);
      message = "";
    } else
      message = !box
        ? "Select geometry to scale"
        : !box.grips.length
          ? "Selection has no extent to scale"
          : "";
    draw();
    if (!grip && target) {
      view.handles?.(
        box!.grips.map((g) => ({ id: g.id, point: g.point, label: g.label })),
        target.id,
      );
      view.cursorHint(target.label, x, y);
    }
    changed();
  };
  return {
    status: () => ({
      active: !!grip,
      typed,
      message:
        message ||
        (!box
          ? "Select geometry to scale"
          : !box.grips.length
            ? "Selection has no extent to scale"
            : ""),
      measurement: measurement(),
    }),
    enable(value: boolean) {
      const was = enabled;
      enabled = value;
      if (value) reset();
      else if (was) {
        reset();
        view.preview([]);
        view.handles?.([]);
        view.cursorHint("", lastX, lastY);
      }
    },
    refresh() {
      if (enabled) {
        reset();
        changed();
      }
    },
    cancel() {
      if (enabled) reset();
    },
    pointer,
    press(x: number, y: number) {
      pressed = { x, y, active: !!grip };
      pointer(x, y, !grip);
    },
    release(x: number, y: number) {
      const p = pressed;
      pressed = null;
      if (!p || !grip) return;
      pointer(x, y);
      if (!p.active && !typed && Math.hypot(x - p.x, y - p.y) <= 3) return;
      if (typed) submit();
      else finish();
    },
    setTyped(value: string) {
      typed = value;
      changed();
    },
    submit,
  };
}
