import { beforeAll, expect, it } from "vitest";
import { initializeGeometry, V, near } from "@gabarito/geometry";
import {
  createStore,
  faces,
  vertices,
  edges,
  validate,
  position,
} from "./index";
import type { Store } from "./store";
beforeAll(initializeGeometry);
function rectangle(s: Store, x = 0, y = 0, size = 100) {
  const p = [V(x, y), V(x + size, y), V(x + size, y + size), V(x, y + size)];
  s.execute({ type: "draw", segments: p.map((a, i) => [a, p[(i + 1) % 4]]) });
}
function component(s: Store, name = "Panel") {
  s.execute({
    type: "make-component",
    ids: Object.keys(s.getState().entities),
    name,
  });
  const id = s.getState().selection[0],
    e = s.getState().entities[id];
  if (e.kind !== "component") throw Error("No component");
  return { id, definition: e.definition };
}
it("extracts shared topology into one definition and selects the atomic instance", () => {
  const s = createStore();
  rectangle(s);
  const { id, definition } = component(s);
  expect(Object.keys(s.getState().entities)).toEqual([id]);
  const d = s.getState().definitions[definition];
  expect(d.name).toBe("Panel");
  expect(
    Object.values(d.geometry.entities).filter((e) => e.kind === "face"),
  ).toHaveLength(1);
  expect(faces(s.getScene())).toHaveLength(1);
  expect(s.selectionTarget(faces(s.getScene())[0].id)).toBe(id);
  s.undo();
  expect(faces(s.getState())).toHaveLength(1);
  expect(Object.keys(s.getState().definitions)).toHaveLength(0);
  s.redo();
  expect(s.getState().selection).toEqual([id]);
});
it("outside drawing does not partition component faces while component edits update every instance", () => {
  const s = createStore();
  rectangle(s);
  const { id, definition } = component(s);
  s.execute({ type: "place-component", definition, point: V(200) });
  const other = s.getState().selection[0];
  rectangle(s, 20, 20, 20);
  expect(faces(s.getState())).toHaveLength(1);
  expect(faces(s.getScene())).toHaveLength(3);
  s.enterComponent(id);
  expect(s.getContext().names).toEqual(["Panel"]);
  rectangle(s, 20, 20, 20);
  expect(faces(s.getState())).toHaveLength(2);
  expect(faces(s.getScene())).toHaveLength(5);
  s.exitComponent();
  s.enterComponent(other);
  expect(faces(s.getState())).toHaveLength(2);
  expect(vertices(s.getState()).every((v) => v.position.x >= 200)).toBe(true);
  s.undo();
  expect(s.getContext().path).toEqual([id]);
  expect(faces(s.getState())).toHaveLength(1);
  s.redo();
  expect(faces(s.getState())).toHaveLength(2);
});
it("preserves boundaries of an unselected neighbor during extraction", () => {
  const s = createStore();
  rectangle(s);
  rectangle(s, 100);
  const left = faces(s.getState()).find((f) =>
    f.outer.some((id) => position(s.getState(), id).x === 0),
  )!;
  s.execute({ type: "make-component", ids: [left.id], name: "Left" });
  validate(s.getState());
  expect(faces(s.getState())).toHaveLength(1);
  expect(edges(s.getState())).toHaveLength(4);
  expect(vertices(s.getState())).toHaveLength(4);
  expect(faces(s.getScene())).toHaveLength(2);
  const extracted = Object.values(s.getState().definitions)[0];
  expect(
    Object.keys(extracted.geometry.entities).some(
      (id) => !!s.getState().entities[id],
    ),
  ).toBe(false);
});
it("transforms an instance independently and edits its shared definition in the transformed world frame", () => {
  const s = createStore();
  rectangle(s);
  const { id, definition } = component(s);
  s.execute({ type: "place-component", definition, point: V(200) });
  const other = s.getState().selection[0];
  s.execute({
    type: "rotate",
    ids: [other],
    center: V(200),
    axis: V(0, 0, 1),
    angle: Math.PI / 2,
  });
  s.execute({
    type: "scale",
    ids: [other],
    anchor: V(200),
    factors: V(2, 3, 1),
  });
  s.execute({ type: "move", ids: [other], delta: V(10, 20, 30) });
  s.enterComponent(other);
  const source = vertices(s.getState()).find((v) =>
    near(v.position, V(210, 20, 30)),
  )!;
  s.execute({ type: "move", ids: [source.id], delta: V(-20) });
  s.exitComponent();
  s.enterComponent(id);
  expect(vertices(s.getState()).some((v) => near(v.position, V(0, 10)))).toBe(
    true,
  );
  s.exitComponent();
  s.enterComponent(other);
  expect(
    vertices(s.getState()).some((v) => near(v.position, V(190, 20, 30))),
  ).toBe(true);
});
it("push/pull inside a linked cube changes all copies and leaves other contexts untouched", () => {
  const s = createStore();
  rectangle(s);
  s.execute({
    type: "pushpull",
    face: faces(s.getState())[0].id,
    distance: 100,
  });
  const { id, definition } = component(s);
  s.execute({ type: "place-component", definition, point: V(200) });
  s.enterComponent(id);
  const top = faces(s.getState()).find((f) =>
    f.outer.every((id) => position(s.getState(), id).z === 100),
  )!;
  s.execute({ type: "pushpull", face: top.id, distance: 25 });
  expect(
    Math.max(...vertices(s.getScene()).map((v) => v.position.z)),
  ).toBeCloseTo(125);
  expect(
    vertices(s.getScene()).filter((v) => near(v.position, V(200, 0, 125))),
  ).toHaveLength(1);
  s.undo();
  expect(
    Math.max(...vertices(s.getScene()).map((v) => v.position.z)),
  ).toBeCloseTo(100);
});
it("renames definitions undoably and preserves them after deleting all instances", () => {
  const s = createStore();
  rectangle(s);
  const { id, definition } = component(s);
  s.execute({ type: "rename-component", definition, name: " Cabinet " });
  expect(s.getState().definitions[definition].name).toBe("Cabinet");
  s.undo();
  expect(s.getState().definitions[definition].name).toBe("Panel");
  s.redo();
  s.execute({ type: "delete", ids: [id] });
  expect(faces(s.getScene())).toHaveLength(0);
  s.execute({ type: "place-component", definition, point: V(300) });
  expect(faces(s.getScene())).toHaveLength(1);
  const before = structuredClone(s.getState());
  expect(() =>
    s.execute({ type: "rename-component", definition, name: " " }),
  ).toThrow();
  expect(s.getState()).toEqual(before);
});
it("supports nested editing and rejects direct and indirect recursive definitions atomically", () => {
  const s = createStore();
  rectangle(s);
  const child = component(s, "Child");
  const parent = component(s, "Parent");
  s.enterComponent(parent.id);
  expect(s.getState().entities[child.id].kind).toBe("component");
  const before = structuredClone(s.getState());
  expect(() =>
    s.execute({
      type: "place-component",
      definition: parent.definition,
      point: V(300),
    }),
  ).toThrow("itself");
  expect(s.getState()).toEqual(before);
  s.enterComponent(child.id);
  rectangle(s, 20, 20, 20);
  expect(s.getContext().names).toEqual(["Parent", "Child"]);
  expect(faces(s.getState())).toHaveLength(2);
  expect(() =>
    s.execute({
      type: "place-component",
      definition: parent.definition,
      point: V(),
    }),
  ).toThrow("itself");
  s.exitComponent();
  s.exitComponent();
  expect(faces(s.getScene())).toHaveLength(2);
});
it("keeps instance identities and IDs monotonic through history and rejects singular transforms", () => {
  const s = createStore();
  rectangle(s);
  const { id, definition } = component(s);
  const before = structuredClone(s.getState());
  expect(() =>
    s.execute({ type: "scale", ids: [id], anchor: V(), factors: V(0, 1, 1) }),
  ).toThrow();
  expect(s.getState()).toEqual(before);
  s.execute({ type: "place-component", definition, point: V(200) });
  const first = s.getState().selection[0];
  s.undo();
  s.execute({ type: "place-component", definition, point: V(300) });
  expect(s.getState().selection[0]).not.toBe(first);
});

it("retains deleted regions when extracted geometry is edited", () => {
  const s = createStore();
  rectangle(s);
  rectangle(s, 20, 20, 20);
  const inner = faces(s.getState()).find(
    (f) =>
      !f.holes.length &&
      f.outer.every((id) => position(s.getState(), id).x <= 40),
  )!;
  s.execute({ type: "delete", ids: [inner.id] });
  const { id } = component(s);
  s.enterComponent(id);
  rectangle(s, 60, 60, 20);
  expect(faces(s.getState())).toHaveLength(2);
  expect(
    faces(s.getState()).some((f) =>
      f.outer.every((id) => position(s.getState(), id).x <= 40),
    ),
  ).toBe(false);
});
it.each(["move", "rotate", "scale", "delete"] as const)(
  "restores exact shared definitions and instances after %s undo/redo",
  (type) => {
    const s = createStore();
    rectangle(s);
    const { id } = component(s),
      before = structuredClone(s.getState());
    if (type === "move") s.execute({ type, ids: [id], delta: V(10, 20, 30) });
    if (type === "rotate")
      s.execute({
        type,
        ids: [id],
        center: V(),
        axis: V(0, 0, 1),
        angle: Math.PI / 3,
      });
    if (type === "scale")
      s.execute({ type, ids: [id], anchor: V(), factors: V(2, 3, 4) });
    if (type === "delete") s.execute({ type, ids: [id] });
    const after = structuredClone(s.getState());
    s.undo();
    expect(s.getState().entities).toEqual(before.entities);
    expect(s.getState().definitions).toEqual(before.definitions);
    s.redo();
    expect(s.getState().entities).toEqual(after.entities);
    expect(s.getState().definitions).toEqual(after.definitions);
  },
);
