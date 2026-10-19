import { beforeAll, expect, it } from "vitest";
import { initializeGeometry, V } from "@gabarito/geometry";
import { createStore, faces, vertices } from "./index";
import type { Store } from "./store";
beforeAll(initializeGeometry);
function make(s: Store, name: string) {
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
function setup() {
  const s = createStore(),
    p = [V(), V(100), V(100, 100), V(0, 100)];
  s.execute({ type: "draw", segments: p.map((a, i) => [a, p[(i + 1) % 4]]) });
  const child = make(s, "Child"),
    parent = make(s, "Parent");
  return { s, child, parent };
}
it("finds unused definitions by scene reachability and preserves reachable nested definitions", () => {
  const { s, child, parent } = setup();
  expect(s.getUnusedComponents()).toEqual([]);
  s.enterComponent(parent.id);
  expect(s.getUnusedComponents()).toEqual([]);
  s.exitComponent();
  s.execute({ type: "delete", ids: [parent.id] });
  expect(new Set(s.getUnusedComponents())).toEqual(
    new Set([child.definition, parent.definition]),
  );
  s.execute({
    type: "place-component",
    definition: child.definition,
    point: V(200),
  });
  expect(s.getUnusedComponents()).toEqual([parent.definition]);
  const before = structuredClone(s.getState());
  s.execute({ type: "purge-components" });
  expect(Object.keys(s.getState().definitions)).toEqual([child.definition]);
  expect(faces(s.getScene())).toHaveLength(1);
  s.undo();
  expect(s.getState().entities).toEqual(before.entities);
  expect(s.getState().definitions).toEqual(before.definitions);
  s.redo();
  expect(Object.keys(s.getState().definitions)).toEqual([child.definition]);
});
it("purges whole unreachable definition trees and does not create history for a no-op", () => {
  const { s, parent } = setup();
  const revision = s.getState().revision;
  s.execute({ type: "purge-components" });
  expect(s.getState().revision).toBe(revision);
  s.execute({ type: "delete", ids: [parent.id] });
  s.execute({ type: "purge-components" });
  expect(s.getState().definitions).toEqual({});
  s.undo();
  expect(Object.keys(s.getState().definitions)).toHaveLength(2);
  expect(s.getUnusedComponents()).toHaveLength(2);
});
it("deletes all occurrences of a library definition across root and nested scopes atomically", () => {
  const { s, child, parent } = setup();
  s.execute({
    type: "place-component",
    definition: child.definition,
    point: V(200),
  });
  const before = structuredClone(s.getState());
  s.execute({ type: "delete-component", definition: child.definition });
  expect(s.getState().definitions[child.definition]).toBeUndefined();
  expect(
    Object.keys(s.getState().definitions[parent.definition].geometry.entities),
  ).toHaveLength(0);
  expect(
    Object.values(s.getState().entities).filter((e) => e.kind === "component"),
  ).toHaveLength(1);
  expect(vertices(s.getScene())).toHaveLength(0);
  s.undo();
  expect(s.getState().entities).toEqual(before.entities);
  expect(s.getState().definitions).toEqual(before.definitions);
  s.redo();
  expect(s.getState().definitions[child.definition]).toBeUndefined();
});
it.each(["child", "parent"] as const)(
  "safely leaves deleted %s contexts and restores them on undo",
  (which) => {
    const { s, child, parent } = setup();
    s.enterComponent(parent.id);
    s.enterComponent(child.id);
    s.execute({
      type: "delete-component",
      definition: which === "child" ? child.definition : parent.definition,
    });
    expect(s.getContext().path).toEqual(which === "child" ? [parent.id] : []);
    s.undo();
    expect(s.getContext().path).toEqual([parent.id, child.id]);
    expect(faces(s.getState())).toHaveLength(1);
    s.redo();
    expect(s.getContext().path).toEqual(which === "child" ? [parent.id] : []);
  },
);
it("distinguishes active descendants from other linked instances without making descendants directly editable", () => {
  const { s, parent } = setup();
  s.execute({
    type: "place-component",
    definition: parent.definition,
    point: V(200),
  });
  s.enterComponent(parent.id);
  const scene = s.getScene(),
    active = faces(scene).find((f) => f.id.startsWith(parent.id + "/"))!,
    other = faces(scene).find((f) => f.id !== active.id)!;
  expect(scene.inactive).not.toContain(active.id);
  expect(scene.inactive).toContain(other.id);
  expect(scene.componentEntities).toContain(active.id);
  expect(s.selectionTarget(active.id)).toBeTruthy();
  expect(s.selectionTarget(other.id)).toBeNull();
  expect(faces(s.getState())).toHaveLength(0);
});
it("rejects unknown library deletion without changing the document or context", () => {
  const { s, parent } = setup();
  s.enterComponent(parent.id);
  const before = structuredClone(s.getState());
  expect(() =>
    s.execute({ type: "delete-component", definition: "missing" }),
  ).toThrow("Missing component definition");
  expect(s.getState()).toEqual(before);
  expect(s.getContext().path).toEqual([parent.id]);
});
