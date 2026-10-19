import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Store } from "@gabarito/core";
import type { Viewport } from "@gabarito/scene";
import type { Controller } from "@gabarito/tools";
import type { Vec3 } from "@gabarito/geometry";
declare global {
  interface Window {
    __gabarito: { store: Store; viewport: Viewport; controller: Controller };
  }
}
async function snapshot(page: Page) {
  return page.evaluate(() => window.__gabarito.store.getState());
}
async function count(page: Page, kind: string) {
  return Object.values((await snapshot(page)).entities).filter(
    (e) => e.kind === kind,
  ).length;
}
async function screenOf(page: Page, point: Vec3) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("No canvas");
  const p = await page.evaluate(
    (p) => window.__gabarito.viewport.project(p),
    point,
  );
  expect(p.visible).toBe(true);
  expect(p.x).toBeGreaterThan(1);
  expect(p.y).toBeGreaterThan(1);
  expect(p.x).toBeLessThan(box.width - 1);
  expect(p.y).toBeLessThan(box.height - 1);
  return { x: box.x + p.x, y: box.y + p.y };
}
async function clickWorld(page: Page, p: Vec3) {
  const q = await screenOf(page, p);
  await page.mouse.click(q.x, q.y);
}
async function type(page: Page, text: string) {
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}
async function rectangle(
  page: Page,
  p = { x: 0, y: 0, z: 0 },
  size = "100,100",
) {
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, p);
  await type(page, size);
}
async function push(page: Page, p: Vec3, distance: string) {
  await page.getByRole("button", { name: /^Push\/Pull/ }).click();
  const start = await screenOf(page, p);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.keyboard.type(distance);
  await page.mouse.up();
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__gabarito)).toBe(true);
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
test("boots with all modeling tools and creates exact typed geometry with undo/redo", async ({
  page,
}) => {
  for (const name of [
    "Select",
    "Line",
    "Rectangle",
    "Circle",
    "Offset",
    "Tape Measure",
    "Move",
    "Scale",
    "Push/Pull",
    "Rotate",
  ])
    await expect(
      page.getByRole("button", {
        name: new RegExp("^" + name.replace("/", "\\/")),
      }),
    ).toBeVisible();
  await rectangle(page);
  expect(await count(page, "face")).toBe(1);
  expect(await count(page, "vertex")).toBe(4);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await count(page, "face")).toBe(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await count(page, "face")).toBe(1);
});
test("partitions a cube surface, cuts a recess and undoes it as one operation", async ({
  page,
}) => {
  await rectangle(page);
  await push(page, { x: 50, y: 50, z: 0 }, "100");
  expect(await count(page, "face")).toBe(6);
  await rectangle(page, { x: 20, y: 20, z: 100 }, "30,30");
  expect(await count(page, "face")).toBe(7);
  const holeCount = await page.evaluate(
    () =>
      Object.values(window.__gabarito.store.getState().entities).filter(
        (e) => e.kind === "face" && e.holes.length,
      ).length,
  );
  expect(holeCount).toBe(1);
  await push(page, { x: 35, y: 35, z: 100 }, "-20");
  const s = await snapshot(page);
  expect(
    Object.values(s.entities).some(
      (e) => e.kind === "vertex" && Math.abs(e.position.z - 80) < 0.001,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await count(page, "face")).toBe(7);
});
for (const distance of [20, -20])
  for (const input of ["typed", "mouse"]) {
    test(`push/pull on a nested raised-sheet face: ${input} ${distance}`, async ({
      page,
    }) => {
      await rectangle(page, { x: 0, y: 0, z: 0 }, "200,200");
      await rectangle(page, { x: 50, y: 50, z: 0 }, "100,100");
      await push(page, { x: 100, y: 100, z: 0 }, "100");
      await rectangle(page, { x: 75, y: 75, z: 100 }, "50,50");
      const before = (await snapshot(page)).entities;
      if (input === "typed")
        await push(page, { x: 100, y: 100, z: 100 }, String(distance));
      else {
        await page.getByRole("button", { name: /^Push\/Pull/ }).click();
        const start = await screenOf(page, { x: 100, y: 100, z: 100 });
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        const target = await screenOf(page, {
          x: 100,
          y: 100,
          z: 100 + distance,
        });
        await page.mouse.move(target.x, target.y, { steps: 8 });
        await page.mouse.up();
      }
      await expect(page.getByRole("status")).not.toContainText("Repair");
      expect(await count(page, "face")).toBe(11);
      const m = await snapshot(page);
      expect(
        Object.values(m.entities).some(
          (e) =>
            e.kind === "vertex" &&
            Math.abs(e.position.z - (100 + distance)) < 1,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      expect((await snapshot(page)).entities).toEqual(before);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      expect((await snapshot(page)).entities).toEqual(m.entities);
    });
  }
test("closes a polygon from visible vertices with the line tool", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Line/ }).click();
  for (const p of [
    { x: -100, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: -50, y: 100, z: 0 },
    { x: -100, y: 0, z: 0 },
  ])
    await clickWorld(page, p);
  expect(await count(page, "face")).toBe(1);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(false);
});
test("moves selected geometry along the height lock and rotates with typed degrees", async ({
  page,
}) => {
  await rectangle(page);
  await page.getByRole("button", { name: /^Select/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  await page.getByRole("button", { name: /^Move/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  await page.keyboard.press("ArrowUp");
  await type(page, "10");
  expect(
    Object.values((await snapshot(page)).entities)
      .filter((e) => e.kind === "vertex")
      .every((e) => e.position.z === 10),
  ).toBe(true);
  await page.getByRole("button", { name: /^Rotate/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 10 });
  await type(page, "45");
  const span = await page.evaluate(() => {
    const ps = Object.values(
      window.__gabarito.store.getState().entities,
    ).filter((e) => e.kind === "vertex");
    return (
      Math.max(...ps.map((v) => v.position.x)) -
      Math.min(...ps.map((v) => v.position.x))
    );
  });
  expect(span).toBeCloseTo(100 * Math.SQRT2, 2);
});
test("changes input units and reports invalid dimensions without committing", async ({
  page,
}) => {
  await page.getByLabel("Display and input units").selectOption("cm");
  await rectangle(page, { x: 0, y: 0, z: 0 }, "10,5");
  const ps = Object.values((await snapshot(page)).entities).filter(
    (e) => e.kind === "vertex",
  );
  expect(Math.max(...ps.map((v) => v.position.x))).toBeCloseTo(100);
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: -100, y: 0, z: 0 });
  await type(page, "0,10");
  await expect(page.getByRole("status")).toContainText("nonzero");
  expect(await count(page, "face")).toBe(1);
});
test("orbits with middle mouse, pans with Shift+middle, zooms with wheel", async ({
  page,
}) => {
  const canvas = page.locator("canvas"),
    box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const state = () =>
    page.evaluate(() => window.__gabarito.viewport.cameraState());
  const before = await state();
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(x + 60, y + 30, { steps: 8 });
  await page.mouse.up({ button: "middle" });
  const orbit = await state();
  expect(orbit.position).not.toEqual(before.position);
  expect(orbit.target).toEqual(before.target);
  await page.keyboard.down("Shift");
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(x + 100, y + 60, { steps: 8 });
  await page.mouse.up({ button: "middle" });
  await page.keyboard.up("Shift");
  const pan = await state();
  expect(pan.target).not.toEqual(orbit.target);
  await page.mouse.wheel(0, -300);
  await expect
    .poll(async () => JSON.stringify((await state()).position))
    .not.toBe(JSON.stringify(pan.position));
  expect(await count(page, "vertex")).toBe(0);
});

test("modeling tools use a precise crosshair cursor", async ({ page }) => {
  for (const name of ["Line", "Rectangle", "Move", "Push/Pull", "Rotate"]) {
    await page
      .getByRole("button", { name: new RegExp("^" + name.replace("/", "\\/")) })
      .click();
    await expect(page.locator("canvas")).toHaveCSS("cursor", "crosshair");
  }
  await page.getByRole("button", { name: /^Select/ }).click();
  await expect(page.locator("canvas")).toHaveCSS("cursor", "auto");
});
test("push/pull previews while held and commits once on release", async ({
  page,
}) => {
  await rectangle(page);
  const before = (await snapshot(page)).entities;
  await page.getByRole("button", { name: /^Push\/Pull/ }).click();
  const a = await screenOf(page, { x: 50, y: 50, z: 0 }),
    b = await screenOf(page, { x: 50, y: 50, z: 40 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  expect(await count(page, "face")).toBe(1);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(true);
  await page.mouse.up();
  expect(await count(page, "face")).toBe(6);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(false);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(before);
});
test("release outside the canvas finishes the captured extrusion", async ({
  page,
}) => {
  await rectangle(page);
  await page.getByRole("button", { name: /^Push\/Pull/ }).click();
  const a = await screenOf(page, { x: 50, y: 50, z: 0 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x, 20, { steps: 8 });
  await page.mouse.up();
  expect(await count(page, "face")).toBe(6);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(false);
});
test("a stationary push/pull click arms click-mode without changing geometry", async ({
  page,
}) => {
  await rectangle(page);
  const before = await snapshot(page);
  await page.getByRole("button", { name: /^Push\/Pull/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  expect(await snapshot(page)).toEqual(before);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(true);
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  expect(await snapshot(page)).toEqual(before);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(false);
});
test("typed dimensions and axis locks work during a held extrusion", async ({
  page,
}) => {
  await rectangle(page);
  await page.getByRole("button", { name: /^Push\/Pull/ }).click();
  const a = await screenOf(page, { x: 50, y: 50, z: 0 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.type("25");
  await page.mouse.up();
  expect(await count(page, "face")).toBe(6);
  const zs = Object.values((await snapshot(page)).entities)
    .filter((e) => e.kind === "vertex")
    .map((v) => v.position.z);
  expect(Math.max(...zs)).toBeCloseTo(25);
});
for (const event of ["Escape", "pointercancel", "lostpointercapture", "blur"]) {
  test(`${event} cancels a held push/pull without changing geometry`, async ({
    page,
  }) => {
    await rectangle(page);
    const before = (await snapshot(page)).entities;
    await page.getByRole("button", { name: /^Push\/Pull/ }).click();
    await page.locator("canvas").evaluate((el) =>
      el.addEventListener(
        "pointerdown",
        (e) => {
          el.dataset.pointerId = String((e as PointerEvent).pointerId);
        },
        { once: true },
      ),
    );
    const a = await screenOf(page, { x: 50, y: 50, z: 0 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.keyboard.type("25");
    if (event === "Escape") await page.keyboard.press("Escape");
    else if (event === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else {
      const pointerId = Number(
        await page.locator("canvas").getAttribute("data-pointer-id"),
      );
      if (event === "lostpointercapture") {
        await page
          .locator("canvas")
          .evaluate((el, id) => el.releasePointerCapture(id), pointerId);
        // Browsers process a pending capture change at the next pointer event.
        await page.mouse.move(a.x + 1, a.y);
      } else
        await page
          .locator("canvas")
          .dispatchEvent("pointercancel", { pointerId, pointerType: "mouse" });
    }
    await expect
      .poll(() =>
        page.evaluate(() => window.__gabarito.controller.status().active),
      )
      .toBe(false);
    await page.mouse.up();
    expect((await snapshot(page)).entities).toEqual(before);
  });
}
test("vertex and edge markers show the actual snap position and clear on leave", async ({
  page,
}) => {
  await rectangle(page);
  const before = await snapshot(page);
  await page.getByRole("button", { name: /^Line/ }).click();
  const v = await screenOf(page, { x: 0, y: 0, z: 0 });
  await page.mouse.move(v.x + 3, v.y + 3);
  const marker = page.locator(".snap-marker");
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute("data-kind", "vertex");
  await expect(marker).toHaveText("Vertex");
  const box = (await marker.boundingBox())!;
  expect(box.x + box.width / 2).toBeCloseTo(v.x, 0);
  expect(box.y + box.height / 2).toBeCloseTo(v.y, 0);
  const e = await screenOf(page, { x: 50, y: 0, z: 0 });
  await page.mouse.move(e.x, e.y);
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute("data-kind", "midpoint");
  await expect(marker).toHaveText("Midpoint");
  expect(await snapshot(page)).toEqual(before);
  await page.mouse.move(10, 10);
  await expect(marker).toBeHidden();
});
test("axis-constrained drawing hides a vertex that cannot be snapped", async ({
  page,
}) => {
  await rectangle(page);
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.press("ArrowRight");
  const p = await screenOf(page, { x: 0, y: 100, z: 0 });
  await page.mouse.move(p.x, p.y);
  await expect(page.locator(".snap-marker")).toBeHidden();
});
test("single, double and triple face clicks expand selection in three stages", async ({
  page,
}) => {
  await rectangle(page);
  await push(page, { x: 50, y: 50, z: 0 }, "100");
  await page.getByRole("button", { name: /^Select/ }).click();
  const p = await screenOf(page, { x: 50, y: 50, z: 100 });
  await page.mouse.click(p.x, p.y);
  expect((await snapshot(page)).selection).toHaveLength(1);
  await page.mouse.click(p.x, p.y, { clickCount: 2 });
  const twice = await snapshot(page);
  expect(twice.selection).toHaveLength(9);
  expect(
    twice.selection
      .map((id) => twice.entities[id])
      .filter((e) => e.kind === "face"),
  ).toHaveLength(1);
  expect(
    twice.selection
      .map((id) => twice.entities[id])
      .filter((e) => e.kind === "edge"),
  ).toHaveLength(4);
  expect(
    twice.selection
      .map((id) => twice.entities[id])
      .filter((e) => e.kind === "vertex"),
  ).toHaveLength(4);
  await page.mouse.click(p.x, p.y, { clickCount: 3 });
  expect((await snapshot(page)).selection).toHaveLength(26);
});
test("rectangle fills a vertical recess mouth as one face without a diagonal edge", async ({
  page,
}) => {
  await rectangle(page);
  await push(page, { x: 50, y: 50, z: 0 }, "100");
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: 20, y: 0, z: 20 });
  await clickWorld(page, { x: 80, y: 0, z: 80 });
  await push(page, { x: 50, y: 0, z: 50 }, "-20");
  const before = await snapshot(page),
    beforeCount = Object.values(before.entities).filter(
      (e) => e.kind === "face",
    ).length;
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: 20, y: 0, z: 80 });
  const b = await screenOf(page, { x: 80, y: 0, z: 20 });
  await page.mouse.move(b.x, b.y);
  await expect(page.getByTitle("Drawing plane")).toHaveText("Boundary");
  await page.mouse.click(b.x, b.y);
  await expect(page.getByRole("status")).not.toContainText("nonzero");
  expect(await count(page, "face")).toBe(beforeCount + 1);
  const after = await snapshot(page),
    added = Object.values(after.entities).filter(
      (e) => e.kind === "face" && !before.entities[e.id],
    );
  expect(added).toHaveLength(1);
  const face = added[0];
  if (face.kind !== "face") throw new Error("Expected a face");
  expect(face.outer).toHaveLength(4);
  expect(face.holes).toHaveLength(0);
  expect(
    face.outer.every((id) => {
      const v = after.entities[id];
      return v.kind === "vertex" && Math.abs(v.position.y) < 0.001;
    }),
  ).toBe(true);
  expect(
    Object.values(after.entities).filter((e) => e.kind === "edge"),
  ).toHaveLength(
    Object.values(before.entities).filter((e) => e.kind === "edge").length,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(after.entities);
});

test("deleting a filled recess divider preserves the front surface", async ({
  page,
}) => {
  await rectangle(page);
  await push(page, { x: 50, y: 50, z: 0 }, "100");
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: 20, y: 0, z: 20 });
  await clickWorld(page, { x: 80, y: 0, z: 80 });
  await push(page, { x: 50, y: 0, z: 50 }, "-20");
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: 20, y: 0, z: 80 });
  await clickWorld(page, { x: 80, y: 0, z: 20 });
  const before = await snapshot(page);
  await page.getByRole("button", { name: /^Select/ }).click();
  await clickWorld(page, { x: 80, y: 0, z: 50 });
  const selected = (await snapshot(page)).selection;
  expect(selected).toHaveLength(1);
  expect(before.entities[selected[0]].kind).toBe("edge");
  await page.keyboard.press("Delete");
  const after = await snapshot(page);
  expect(after.entities[selected[0]]).toBeUndefined();
  const front = Object.values(after.entities).filter(
    (e) =>
      e.kind === "face" &&
      e.outer.every((id) => {
        const v = after.entities[id];
        return v.kind === "vertex" && Math.abs(v.position.y) < 0.001;
      }),
  );
  expect(front).toHaveLength(1);
  if (front[0].kind !== "face") throw new Error("Expected front face");
  expect(front[0].holes).toHaveLength(0);
  expect(front[0].outer).toHaveLength(4);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(after.entities);
});

test("tape click/click measures a midpoint and creates an undoable parallel ruler", async ({
  page,
}) => {
  await rectangle(page);
  await page.getByRole("button", { name: /^Tape Measure/ }).click();
  const source = await screenOf(page, { x: 50, y: 0, z: 0 });
  await page.mouse.move(source.x, source.y);
  await expect(page.locator(".snap-label")).toHaveText("Midpoint");
  await page.mouse.click(source.x, source.y);
  expect(await count(page, "guide")).toBe(0);
  const end = await screenOf(page, { x: 50, y: 50, z: 0 });
  await page.mouse.move(end.x, end.y);
  await expect(page.locator(".cursor-hint")).toContainText("50.00 mm");
  await page.getByLabel("Display and input units").selectOption("cm");
  await expect(page.locator(".cursor-hint")).toContainText("5.00 cm");
  await page.mouse.click(end.x, end.y);
  expect(await count(page, "guide")).toBe(1);
  const m = await snapshot(page),
    guide = Object.values(m.entities).find((e) => e.kind === "guide")!;
  if (guide.kind !== "guide") throw new Error("Expected ruler");
  expect(Math.abs(guide.direction.x)).toBeCloseTo(1);
  expect(guide.origin.y).toBeCloseTo(50);
  expect(await count(page, "edge")).toBe(4);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await count(page, "guide")).toBe(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(m.entities);
  // Draw directly along the virtual ruler, beyond the original face.
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, { x: 150, y: 50, z: 0 });
  await clickWorld(page, { x: 200, y: 50, z: 0 });
  expect(await count(page, "guide")).toBe(1);
  expect(await count(page, "edge")).toBe(5);
});

test("tape drag from a face commits only on release; cancelled gestures add no ruler", async ({
  page,
}) => {
  await rectangle(page);
  await page.keyboard.press("t");
  const a = await screenOf(page, { x: 30, y: 30, z: 0 }),
    b = await screenOf(page, { x: 60, y: 70, z: 0 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.keyboard.down("Alt");
  await page.mouse.move(b.x, b.y);
  await expect(page.locator(".cursor-hint")).toContainText("50.00 mm");
  expect(await count(page, "guide")).toBe(0);
  await page.mouse.up();
  await page.keyboard.up("Alt");
  expect(await count(page, "guide")).toBe(1);
  const g = Object.values((await snapshot(page)).entities).find(
    (e) => e.kind === "guide",
  )!;
  if (g.kind !== "guide") throw new Error("Expected ruler");
  expect(g.direction.x).toBeCloseTo(0.6);
  expect(g.direction.y).toBeCloseTo(0.8);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await count(page, "guide")).toBe(1);
  await expect(page.locator(".cursor-hint")).toBeHidden();
});

test("world axes and origin snap without becoming deletable geometry", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Line/ }).click();
  const origin = await screenOf(page, { x: 0, y: 0, z: 0 });
  await page.mouse.move(origin.x, origin.y);
  await expect(page.locator(".snap-label")).toHaveText("Origin");
  const z = await screenOf(page, { x: 0, y: 0, z: 100 });
  await page.mouse.move(z.x, z.y);
  await expect(page.locator(".snap-label")).toHaveText("Z axis");
  await page.mouse.click(origin.x, origin.y);
  await page.mouse.click(z.x, z.y);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Space");
  await clickWorld(page, { x: 100, y: 0, z: 0 });
  expect((await snapshot(page)).selection).toHaveLength(0);
  await page.keyboard.press("Delete");
  expect(await count(page, "guide")).toBe(0);
  expect(await count(page, "edge")).toBe(1);
});

test("rectangle proportions show a temporary diagonal hint and keep only four real edges", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  const square = await screenOf(page, { x: 100, y: 100, z: 0 });
  await page.mouse.move(square.x, square.y);
  await expect(page.locator(".cursor-hint")).toHaveText("Square · 1:1");
  const ratio = await screenOf(page, { x: 200, y: 100, z: 0 });
  await page.mouse.move(ratio.x, ratio.y);
  await expect(page.locator(".cursor-hint")).toHaveText("2:1");
  await page.mouse.click(ratio.x, ratio.y);
  expect(await count(page, "edge")).toBe(4);
  await expect(page.locator(".cursor-hint")).toBeHidden();
});

for (const mode of ["click", "drag"] as const) {
  for (const event of ["blur", "pointercancel"] as const) {
    test(`tape ${mode} cancellation on ${event} creates no ruler`, async ({
      page,
    }) => {
      await rectangle(page);
      await page.keyboard.press("t");
      const a = await screenOf(page, { x: 30, y: 30, z: 0 }),
        b = await screenOf(page, { x: 60, y: 70, z: 0 });
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      if (mode === "click") await page.mouse.up();
      await page.mouse.move(b.x, b.y);
      await expect(page.locator(".cursor-hint")).toBeVisible();
      if (event === "blur")
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      else
        await page.locator("canvas").dispatchEvent("pointercancel", {
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
        });
      if (mode === "drag") await page.mouse.up();
      expect(await count(page, "guide")).toBe(0);
      expect(
        await page.evaluate(() => window.__gabarito.controller.status().active),
      ).toBe(false);
      await expect(page.locator(".cursor-hint")).toBeHidden();
    });
  }
}

for (const bypass of [false, true]) {
  test(`face midpoint alignment commits ${bypass ? "raw coordinates with Alt" : "an exact midline"}`, async ({
    page,
  }) => {
    await rectangle(page);
    await page.keyboard.press("f");
    await page.getByRole("button", { name: /^Rectangle/ }).click();
    await clickWorld(page, { x: 30, y: 30, z: 0 });
    const p = await screenOf(page, { x: 40, y: 49, z: 0 });
    await page.mouse.move(p.x, p.y);
    await expect(page.locator(".cursor-hint")).toContainText(
      "Midpoint alignment",
    );
    if (bypass) {
      await page.keyboard.down("Alt");
      await expect(
        page.getByText("Snapping off · Alt", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".snap-marker")).toBeHidden();
    }
    await page.mouse.click(p.x, p.y);
    if (bypass) await page.keyboard.up("Alt");
    const points = Object.values((await snapshot(page)).entities)
      .filter((e) => e.kind === "vertex")
      .map((v) => v.position);
    expect(
      points.some(
        (p) =>
          Math.abs(p.x - 40) < 0.5 &&
          Math.abs(p.y - (bypass ? 49 : 50)) < (bypass ? 0.5 : 0.00001),
      ),
    ).toBe(true);
  });
}
for (const [x, y, ratio] of [
  [100, 98, 1],
  [200, 98, 2],
] as const) {
  test(`rectangle proximity snapping commits exact ${ratio}:1 dimensions`, async ({
    page,
  }) => {
    await page.getByRole("button", { name: /^Rectangle/ }).click();
    await clickWorld(page, { x: 0, y: 0, z: 0 });
    const p = await screenOf(page, { x, y, z: 0 });
    await page.mouse.move(p.x, p.y);
    await expect(page.locator(".cursor-hint")).toContainText(
      ratio === 1 ? "1:1" : "2:1",
    );
    await page.keyboard.down("Alt");
    await expect(page.locator(".cursor-hint")).toBeHidden();
    await page.keyboard.up("Alt");
    await expect(page.locator(".cursor-hint")).toBeVisible();
    await page.mouse.click(p.x, p.y);
    const points = Object.values((await snapshot(page)).entities)
      .filter((e) => e.kind === "vertex")
      .map((v) => v.position);
    expect(
      Math.max(...points.map((p) => p.x)) / Math.max(...points.map((p) => p.y)),
    ).toBeCloseTo(ratio, 6);
    expect(await count(page, "edge")).toBe(4);
  });
}

test("line drawing snaps to a face diagonal and Alt resets after blur", async ({
  page,
}) => {
  await rectangle(page);
  await page.keyboard.press("f");
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, { x: 10, y: 15, z: 0 });
  const p = await screenOf(page, { x: 25, y: 26, z: 0 });
  await page.mouse.move(p.x, p.y);
  await expect(page.locator(".snap-label")).toHaveText("Face diagonal");
  await page.keyboard.down("Alt");
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().snapping),
  ).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().snapping),
  ).toBe(true);
  await page.keyboard.up("Alt");
  await page.mouse.move(p.x + 1, p.y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  const points = Object.values((await snapshot(page)).entities)
    .filter((e) => e.kind === "vertex")
    .map((v) => v.position);
  expect(
    points.some((p) => p.x > 20 && p.x < 30 && Math.abs(p.x - p.y) < 0.00001),
  ).toBe(true);
});

for (const kind of ["vertex", "edge", "face"] as const) {
  test(`push/pull matches a visible ${kind} depth`, async ({ page }) => {
    await rectangle(page);
    await page.evaluate((kind) => {
      const { store } = window.__gabarito;
      const V = (x: number, y: number, z: number) => ({ x, y, z });
      if (kind === "face") {
        const p = [
          V(110, 40, 25),
          V(150, 40, 25),
          V(150, 90, 25),
          V(110, 90, 25),
        ];
        store.execute({
          type: "draw",
          segments: p.map((a, i) => [a, p[(i + 1) % 4]]),
        });
      } else
        store.execute({
          type: "draw",
          segments: [[V(150, 0, 25), V(170, 0, 25)]],
        });
    }, kind);
    await page.getByRole("button", { name: /^Push\/Pull/ }).click();
    const a = await screenOf(page, {
      x: kind === "face" ? 90 : 50,
      y: 50,
      z: 0,
    });
    const b = await screenOf(
      page,
      kind === "face"
        ? { x: 130, y: 63.25, z: 25 }
        : { x: kind === "vertex" ? 150 : 160, y: 0, z: 25 },
    );
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y);
    await expect(page.locator(".cursor-hint")).toContainText(
      `${kind[0].toUpperCase() + kind.slice(1)} level`,
    );
    await page.mouse.up();
    const m = await snapshot(page);
    const cap = Object.values(m.entities).find(
      (e) =>
        e.kind === "face" &&
        e.outer.every((id) => {
          const v = m.entities[id];
          return (
            v.kind === "vertex" &&
            Math.abs(v.position.z - 25) < 0.00001 &&
            v.position.x <= 100.00001
          );
        }),
    );
    expect(cap).toBeDefined();
  });
}

for (const gesture of ["click", "drag"] as const) {
  for (const target of ["midline", "diagonal"] as const) {
    test(`tape ${gesture} snaps its committed ruler to a face ${target}`, async ({
      page,
    }) => {
      await rectangle(page);
      await page.keyboard.press("f");
      await page.keyboard.press("t");
      const before = await snapshot(page),
        a = await screenOf(page, { x: 30, y: 30, z: 0 });
      const b = await screenOf(
        page,
        target === "midline" ? { x: 40, y: 49, z: 0 } : { x: 25, y: 26, z: 0 },
      );
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      if (gesture === "click") await page.mouse.up();
      await page.mouse.move(b.x, b.y);
      await expect(page.locator(".cursor-hint")).toContainText(
        target === "midline" ? "Midpoint alignment" : "Face diagonal",
      );
      expect(await count(page, "guide")).toBe(0);
      if (gesture === "click") await page.mouse.down();
      await page.mouse.up();
      const after = await snapshot(page),
        guide = Object.values(after.entities).find((e) => e.kind === "guide")!;
      if (guide.kind !== "guide") throw new Error("Expected ruler");
      if (target === "midline") {
        expect(guide.origin.y).toBeCloseTo(50, 6);
        expect(guide.origin.x).toBeCloseTo(40, 0);
      } else expect(guide.origin.x).toBeCloseTo(guide.origin.y, 6);
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      expect((await snapshot(page)).entities).toEqual(before.entities);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      expect((await snapshot(page)).entities).toEqual(after.entities);
    });
  }
}

test("push/pull click/move/click previews without holding and commits once with exact history", async ({
  page,
}) => {
  await rectangle(page);
  const before = await snapshot(page);
  await page.getByRole("button", { name: /^Push\/Pull/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  const target = await screenOf(page, { x: 50, y: 50, z: 40 });
  await page.mouse.move(target.x, target.y);
  expect((await snapshot(page)).entities).toEqual(before.entities);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(true);
  await page.mouse.click(target.x, target.y);
  expect(await count(page, "face")).toBe(6);
  const after = await snapshot(page);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(false);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(after.entities);
});

test("click-mode push/pull accepts typed dimensions and clears its axis pin", async ({
  page,
}) => {
  await rectangle(page);
  await page.getByRole("button", { name: /^Push\/Pull/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  await page.keyboard.press("ArrowUp");
  await type(page, "25");
  expect(await count(page, "face")).toBe(6);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().axis),
  ).toBe("Free");
  const m = await snapshot(page);
  expect(
    Math.max(
      ...Object.values(m.entities)
        .filter((e) => e.kind === "vertex")
        .map((v) => v.position.z),
    ),
  ).toBeCloseTo(25);
});

for (const event of ["Escape", "blur"] as const) {
  test(`pending click-mode push/pull cancels on ${event}`, async ({ page }) => {
    await rectangle(page);
    const before = await snapshot(page);
    await page.getByRole("button", { name: /^Push\/Pull/ }).click();
    await clickWorld(page, { x: 50, y: 50, z: 0 });
    const p = await screenOf(page, { x: 50, y: 50, z: 30 });
    await page.mouse.move(p.x, p.y);
    if (event === "Escape") await page.keyboard.press("Escape");
    else await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    expect((await snapshot(page)).entities).toEqual(before.entities);
    expect(
      await page.evaluate(() => window.__gabarito.controller.status().active),
    ).toBe(false);
  });
}

test("line axis pins reset after each segment, Escape and tool changes", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.press("ArrowRight");
  await type(page, "100");
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().axis),
  ).toBe("Free");
  await clickWorld(page, { x: 100, y: 100, z: 0 });
  const m = await snapshot(page);
  expect(
    Object.values(m.entities).some(
      (e) => e.kind === "vertex" && Math.abs(e.position.y - 100) < 0.5,
    ),
  ).toBe(true);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().axis),
  ).toBe("Free");
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: /^Tape Measure/ }).click();
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().axis),
  ).toBe("Free");
});

async function addConstrainedReference(
  page: Page,
  kind: "vertex" | "edge" | "face",
) {
  await page.evaluate((kind) => {
    const { store } = window.__gabarito;
    const p = [
      { x: 100, y: -150, z: 80 },
      { x: 200, y: -150, z: 80 },
      { x: 200, y: -50, z: 80 },
      { x: 100, y: -50, z: 80 },
    ];
    store.execute({
      type: "draw",
      segments:
        kind === "face"
          ? p.map((a, i) => [a, p[(i + 1) % 4]])
          : [
              [
                { x: 140, y: -180, z: 80 },
                { x: 160, y: -180, z: 80 },
              ],
            ],
    });
  }, kind);
  return kind === "face"
    ? { x: 150, y: -100, z: 80 }
    : { x: kind === "vertex" ? 140 : 150, y: -180, z: 80 };
}
for (const gesture of ["click", "drag"] as const) {
  test(`push/pull ${gesture} aligns to an explicitly aimed face far from free depth`, async ({
    page,
  }) => {
    await rectangle(page);
    const ref = await addConstrainedReference(page, "face"),
      before = await snapshot(page);
    await page.getByRole("button", { name: /^Push\/Pull/ }).click();
    const a = await screenOf(page, { x: 50, y: 80, z: 0 }),
      b = await screenOf(page, ref);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    if (gesture === "click") await page.mouse.up();
    await page.mouse.move(b.x, b.y);
    await expect(page.locator(".cursor-hint")).toContainText("Face level");
    if (gesture === "click") await page.mouse.down();
    await page.mouse.up();
    const after = await snapshot(page);
    expect(
      Object.values(after.entities).some(
        (e) =>
          e.kind === "face" &&
          e.outer.every((id) => {
            const v = after.entities[id];
            return (
              v.kind === "vertex" &&
              Math.abs(v.position.z - 80) < 0.00001 &&
              v.position.y >= 0
            );
          }),
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(before.entities);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(after.entities);
  });
}
for (const [kind, axis, key] of [
  ["vertex", "x", "ArrowRight"],
  ["edge", "y", "ArrowLeft"],
  ["face", "z", "ArrowUp"],
] as const) {
  test(`Move pinned to ${axis.toUpperCase()} matches a hovered ${kind} reference`, async ({
    page,
  }) => {
    await rectangle(page);
    const initial = await snapshot(page),
      source = Object.values(initial.entities).find((e) => e.kind === "face")!;
    if (source.kind !== "face") throw new Error("Expected source face");
    const ref = await addConstrainedReference(page, kind),
      before = await snapshot(page);
    await page.evaluate(
      (id) => window.__gabarito.store.select([id]),
      source.id,
    );
    await page.getByRole("button", { name: /^Move/ }).click();
    await clickWorld(page, { x: 0, y: 0, z: 0 });
    await page.keyboard.press(key);
    const b = await screenOf(page, ref);
    await page.mouse.move(b.x, b.y);
    await expect(page.locator(".cursor-hint")).toContainText(
      `${kind[0].toUpperCase() + kind.slice(1)} level`,
    );
    if (kind !== "face")
      await expect(page.locator(".snap-marker")).toBeVisible();
    await page.mouse.click(b.x, b.y);
    const after = await snapshot(page),
      delta = ref[axis];
    for (const id of source.outer) {
      const v = after.entities[id],
        old = before.entities[id];
      if (v.kind !== "vertex" || old.kind !== "vertex")
        throw new Error("Expected source vertex");
      for (const coordinate of ["x", "y", "z"] as const)
        expect(v.position[coordinate]).toBeCloseTo(
          old.position[coordinate] + (coordinate === axis ? delta : 0),
          5,
        );
    }
    expect(
      await page.evaluate(() => window.__gabarito.controller.status().axis),
    ).toBe("Free");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(before.entities);
  });
}

for (const side of ["top", "side"] as const) {
  test(`Rotate uses A and B on a cube ${side} face for zero, signed preview and one-step history`, async ({
    page,
  }) => {
    await rectangle(page);
    await push(page, { x: 50, y: 50, z: 0 }, "100");
    await page.keyboard.press("f");
    const before = await snapshot(page);
    const a =
      side === "top" ? { x: 50, y: 50, z: 100 } : { x: 50, y: 0, z: 50 };
    const b =
      side === "top" ? { x: 100, y: 50, z: 100 } : { x: 100, y: 0, z: 50 };
    // Select the whole solid; rotation must preserve a rigid cube.
    await page.evaluate(() => {
      const { store } = window.__gabarito;
      store.select(Object.keys(store.getState().entities));
    });
    await page.getByRole("button", { name: /^Rotate/ }).click();
    const ap = await screenOf(page, a);
    await page.mouse.move(ap.x, ap.y);
    await expect(page.locator(".cursor-hint")).toContainText(
      "Reference intersection",
    );
    await expect(page.locator(".snap-marker")).toBeVisible();
    await page.mouse.click(ap.x, ap.y);
    const bp = await screenOf(page, b);
    await page.mouse.move(bp.x, bp.y);
    await expect(page.locator(".cursor-hint")).toContainText("0.0°");
    expect((await snapshot(page)).entities).toEqual(before.entities);
    await page.mouse.click(bp.x, bp.y);
    await expect(page.locator(".cursor-hint")).toContainText("0.0°");
    const positive =
      side === "top" ? { x: 50, y: 100, z: 100 } : { x: 50, y: 0, z: 0 };
    const negative =
      side === "top" ? { x: 50, y: 0, z: 100 } : { x: 50, y: 0, z: 100 };
    const cp = await screenOf(page, positive),
      dp = await screenOf(page, negative);
    await page.mouse.move(dp.x, dp.y);
    expect(
      Math.abs(parseFloat(await page.locator(".cursor-hint").innerText()) + 90),
    ).toBeLessThan(1);
    await page.mouse.move(cp.x, cp.y);
    expect(
      Math.abs(parseFloat(await page.locator(".cursor-hint").innerText()) - 90),
    ).toBeLessThan(1);
    expect((await snapshot(page)).entities).toEqual(before.entities);
    await page.mouse.click(cp.x, cp.y);
    const after = await snapshot(page);
    // The face-interior anchor comes from pixel-precision clicks; headless tests assert exact angles and coordinates.
    for (const entity of Object.values(before.entities)) {
      if (entity.kind !== "vertex") continue;
      const q = entity.position,
        result = after.entities[entity.id];
      if (result.kind !== "vertex")
        throw new Error("Missing transformed vertex");
      const expected =
        side === "top"
          ? { x: a.x - (q.y - a.y), y: a.y + (q.x - a.x), z: q.z }
          : { x: a.x + (q.z - a.z), y: q.y, z: a.z - (q.x - a.x) };
      for (const axis of ["x", "y", "z"] as const)
        expect(Math.abs(result.position[axis] - expected[axis])).toBeLessThan(
          1,
        );
    }
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(before.entities);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(after.entities);
  });
}

test("Rotate cancels after B and accepts signed typed degrees on its next use", async ({
  page,
}) => {
  await rectangle(page);
  const before = await snapshot(page);
  await page.evaluate(() => {
    const { store } = window.__gabarito;
    store.select(
      Object.values(store.getState().entities)
        .filter((e) => e.kind === "face")
        .map((e) => e.id),
    );
  });
  await page.getByRole("button", { name: /^Rotate/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await clickWorld(page, { x: 100, y: 0, z: 0 });
  const q = await screenOf(page, { x: 0, y: 100, z: 0 });
  await page.mouse.move(q.x, q.y);
  await expect(page.locator(".cursor-hint")).toContainText("90.0°");
  await page.keyboard.press("Escape");
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await expect(page.locator(".cursor-hint")).not.toBeVisible();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await clickWorld(page, { x: 100, y: 0, z: 0 });
  await type(page, "-90");
  const after = await snapshot(page);
  for (const e of Object.values(before.entities)) {
    if (e.kind !== "vertex") continue;
    const actual = after.entities[e.id];
    if (actual.kind !== "vertex") throw new Error("Missing rotated vertex");
    expect(actual.position.x).toBeCloseTo(e.position.y);
    expect(actual.position.y).toBeCloseTo(-e.position.x);
    expect(actual.position.z).toBeCloseTo(e.position.z);
  }
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(before.entities);
});

test("Rotate shows face-center, midpoint and diagonal hints and Alt bypasses their snapping", async ({
  page,
}) => {
  await rectangle(page);
  await page.keyboard.press("f");
  const before = await snapshot(page);
  await page.getByRole("button", { name: /^Select/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  await page.getByRole("button", { name: /^Rotate/ }).click();
  const a = await screenOf(page, { x: 49, y: 49, z: 0 });
  await page.mouse.move(a.x, a.y);
  await expect(page.locator(".cursor-hint")).toContainText(
    "Reference intersection",
  );
  await expect(page.locator(".snap-marker")).toBeVisible();
  await page.mouse.click(a.x, a.y);
  const b = await screenOf(page, { x: 85, y: 49, z: 0 });
  await page.mouse.move(b.x, b.y);
  await expect(page.locator(".cursor-hint")).toContainText(
    "Midpoint alignment",
  );
  await page.mouse.click(b.x, b.y);
  const c = await screenOf(page, { x: 60, y: 61, z: 0 });
  await page.mouse.move(c.x, c.y);
  await expect(page.locator(".cursor-hint")).toContainText("45.0°");
  await expect(page.locator(".cursor-hint")).toContainText("Face diagonal");
  await expect(page.locator(".snap-marker")).toHaveAttribute(
    "data-kind",
    "diagonal",
  );
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await page.keyboard.down("Alt");
  await expect(page.locator(".snap-marker")).toBeHidden();
  expect(
    parseFloat(await page.locator(".cursor-hint").innerText()),
  ).toBeGreaterThan(46);
  await page.keyboard.up("Alt");
  await expect(page.locator(".cursor-hint")).toContainText("Face diagonal");
  await page.mouse.click(c.x, c.y);
  const after = await snapshot(page);
  for (const e of Object.values(before.entities)) {
    if (e.kind !== "vertex") continue;
    const actual = after.entities[e.id];
    if (actual.kind !== "vertex") throw new Error("Missing rotated vertex");
    expect(actual.position.x).toBeCloseTo(
      50 + (e.position.x - e.position.y) / Math.SQRT2,
      5,
    );
    expect(actual.position.y).toBeCloseTo(
      50 + (e.position.x + e.position.y - 100) / Math.SQRT2,
      5,
    );
    expect(actual.position.z).toBeCloseTo(0, 5);
  }
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(after.entities);
});

async function selectedCube(page: Page) {
  await rectangle(page);
  await push(page, { x: 50, y: 50, z: 0 }, "100");
  await page.keyboard.press("f");
  await page.getByRole("button", { name: /^Select/ }).click();
  await page.evaluate(() => {
    const { store } = window.__gabarito;
    store.select(Object.keys(store.getState().entities));
  });
  await page.getByRole("button", { name: /^Scale/ }).click();
}
for (const gesture of ["drag", "click"] as const) {
  test(`Scale ${gesture} stretches a face grip, keeps its opposite anchor and commits once`, async ({
    page,
  }) => {
    await selectedCube(page);
    await expect(page.locator(".scale-handle")).toHaveCount(26);
    const handle = page.locator('[data-scale-handle="1,0,0"]');
    await expect(handle).toBeVisible();
    await expect(page.locator('[data-scale-handle="-1,0,0"]')).toBeHidden();
    const before = await snapshot(page),
      a = await screenOf(page, { x: 100, y: 50, z: 50 }),
      b = await screenOf(page, { x: 150, y: 50, z: 50 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    if (gesture === "click") await page.mouse.up();
    await page.mouse.move(b.x, b.y);
    await expect(page.locator(".cursor-hint")).toContainText("1.500");
    expect((await snapshot(page)).entities).toEqual(before.entities);
    if (gesture === "click") await page.mouse.down();
    await page.mouse.up();
    const after = await snapshot(page);
    for (const e of Object.values(before.entities)) {
      if (e.kind !== "vertex") continue;
      const v = after.entities[e.id];
      if (v.kind !== "vertex") throw new Error("Missing scaled vertex");
      expect(v.position.x).toBeCloseTo(e.position.x * 1.5, 1);
      expect(v.position.y).toBeCloseTo(e.position.y, 5);
      expect(v.position.z).toBeCloseTo(e.position.z, 5);
    }
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(before.entities);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(after.entities);
    await page.getByRole("button", { name: /^Select/ }).click();
    await expect(page.locator(".scale-handle")).toHaveCount(0);
  });
}
test("Scale corners accept typed factors and Escape/blur discard previews", async ({
  page,
}) => {
  await selectedCube(page);
  const before = await snapshot(page),
    a = await screenOf(page, { x: 100, y: 0, z: 100 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.keyboard.type("2");
  await page.mouse.up();
  const after = await snapshot(page);
  for (const e of Object.values(before.entities)) {
    if (e.kind !== "vertex") continue;
    const v = after.entities[e.id];
    if (v.kind !== "vertex") throw new Error("Missing scaled vertex");
    expect(v.position.x).toBeCloseTo(e.position.x * 2, 5);
    expect(v.position.y).toBeCloseTo(100 + (e.position.y - 100) * 2, 5);
    expect(v.position.z).toBeCloseTo(e.position.z * 2, 5);
  }
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  for (const cancel of ["Escape", "blur"] as const) {
    const b = await screenOf(page, { x: 150, y: 50, z: 50 }),
      start = await screenOf(page, { x: 100, y: 50, z: 50 });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(b.x, b.y);
    if (cancel === "Escape") await page.keyboard.press("Escape");
    else await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    expect((await snapshot(page)).entities).toEqual(before.entities);
    expect(
      await page.evaluate(() => window.__gabarito.controller.status().active),
    ).toBe(false);
    await expect(page.locator(".scale-handle")).toHaveCount(26);
  }
});
test("Scale supports flat bounds, hides occluded handles and follows camera changes", async ({
  page,
}) => {
  await rectangle(page);
  await page.keyboard.press("f");
  await page.getByRole("button", { name: /^Select/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  await page.keyboard.press("s");
  await expect(page.locator(".scale-handle")).toHaveCount(8);
  const a = await screenOf(page, { x: 100, y: 0, z: 0 });
  await page.mouse.click(a.x, a.y);
  await type(page, "2");
  expect(
    Object.values((await snapshot(page)).entities)
      .filter((e) => e.kind === "vertex")
      .every((v) => v.position.z === 0),
  ).toBe(true);
  const grip = page.locator('[data-scale-handle="1,-1,0"]'),
    old = await grip.boundingBox();
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => (await grip.boundingBox())?.x).not.toBe(old?.x);
  await page.evaluate(() => window.__gabarito.store.select([]));
  await expect(page.locator(".scale-handle")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Select geometry");
});

test("Scale edge grips distort two dimensions and changing tools during drag does not send a stray click", async ({
  page,
}) => {
  await selectedCube(page);
  const before = await snapshot(page),
    a = await screenOf(page, { x: 100, y: 0, z: 50 }),
    b = await screenOf(page, { x: 115, y: -10, z: 50 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  const after = await snapshot(page);
  for (const e of Object.values(before.entities)) {
    if (e.kind !== "vertex") continue;
    const v = after.entities[e.id];
    if (v.kind !== "vertex") throw new Error("Missing distorted vertex");
    expect(v.position.x).toBeCloseTo(e.position.x * 1.15, 4);
    expect(v.position.y).toBeCloseTo(100 + (e.position.y - 100) * 1.1, 4);
    expect(v.position.z).toBeCloseTo(e.position.z, 5);
  }
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await page.keyboard.press("l");
  await page.mouse.up();
  expect((await snapshot(page)).entities).toEqual(before.entities);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(false);
  await expect(page.locator(".scale-handle")).toHaveCount(0);
});

test("Circle uses radius, applies segment settings only to new geometry, and supports exact history", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Circle/ }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Circle segments" }),
  ).toHaveValue("24");
  const setting = page.getByRole("spinbutton", { name: "Circle segments" });
  await setting.fill("");
  await setting.pressSequentially("16");
  await expect(setting).toHaveValue("16");
  expect(
    await page.evaluate(
      () => window.__gabarito.controller.status().circleSegments,
    ),
  ).toBe(16);
  await page.getByRole("spinbutton", { name: "Circle segments" }).fill("32");
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await expect(
    page.getByRole("textbox", { name: "Radius", exact: true }),
  ).toBeVisible();
  await type(page, "25");
  const first = await snapshot(page),
    ps = Object.values(first.entities).filter((e) => e.kind === "vertex");
  expect(ps).toHaveLength(32);
  for (const p of ps)
    expect(Math.hypot(p.position.x, p.position.y, p.position.z)).toBeCloseTo(
      25,
      5,
    );
  await page.getByRole("spinbutton", { name: "Circle segments" }).fill("24");
  expect((await snapshot(page)).entities).toEqual(first.entities);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await count(page, "face")).toBe(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(first.entities);
});
test("Circle shares face-center hints, partitions cube faces and remains extrudable", async ({
  page,
}) => {
  await rectangle(page);
  await push(page, { x: 50, y: 50, z: 0 }, "100");
  await page.keyboard.press("f");
  const before = await snapshot(page);
  await page.keyboard.press("c");
  const a = await screenOf(page, { x: 49, y: 49, z: 100 });
  await page.mouse.move(a.x, a.y);
  await expect(page.locator(".cursor-hint")).toContainText(
    "Reference intersection",
  );
  await expect(page.locator(".snap-marker")).toBeVisible();
  await page.mouse.click(a.x, a.y);
  await type(page, "20");
  const after = await snapshot(page),
    circle = Object.values(after.entities).find(
      (e) => e.kind === "face" && e.outer.length === 24,
    )!;
  if (circle.kind !== "face") throw new Error("Missing circle face");
  for (const id of circle.outer) {
    const v = after.entities[id];
    if (v.kind !== "vertex") throw new Error("Missing vertex");
    expect(v.position.z).toBeCloseTo(100, 5);
    expect(Math.hypot(v.position.x - 50, v.position.y - 50)).toBeCloseTo(20, 5);
  }
  expect(await count(page, "face")).toBe(7);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await snapshot(page)).entities).toEqual(after.entities);
  await push(page, { x: 50, y: 50, z: 100 }, "10");
  expect(
    Object.values((await snapshot(page)).entities).some(
      (e) => e.kind === "vertex" && Math.abs(e.position.z - 110) < 1e-5,
    ),
  ).toBe(true);
});
test("Circle mouse radius on a vertical face freezes its plane and cancels on blur", async ({
  page,
}) => {
  await rectangle(page);
  await push(page, { x: 50, y: 50, z: 0 }, "100");
  await page.keyboard.press("f");
  const before = await snapshot(page);
  await page.keyboard.press("c");
  await clickWorld(page, { x: 50, y: 0, z: 50 });
  const b = await screenOf(page, { x: 70, y: 0, z: 50 });
  await page.mouse.move(b.x, b.y);
  await expect(page.locator(".cursor-hint")).toContainText("Radius 20.00");
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await page.mouse.click(b.x, b.y);
  const after = await snapshot(page),
    circle = Object.values(after.entities).find(
      (e) => e.kind === "face" && e.outer.length === 24,
    )!;
  if (circle.kind !== "face") throw new Error("Missing circle face");
  expect(
    circle.outer.every((id) => {
      const v = after.entities[id];
      return v.kind === "vertex" && Math.abs(v.position.y) < 1e-5;
    }),
  ).toBe(true);
  await clickWorld(page, { x: 50, y: 0, z: 50 });
  await page.mouse.move(b.x, b.y);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect((await snapshot(page)).entities).toEqual(after.entities);
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(false);
});
for (const typed of [true, false]) {
  test(`Offset ${typed ? "typed distance" : "mouse distance"} makes an equal rectangle border and one history entry`, async ({
    page,
  }) => {
    await rectangle(page, { x: 0, y: 0, z: 0 }, "100,80");
    await page.keyboard.press("f");
    const before = await snapshot(page);
    await page.keyboard.press("o");
    await clickWorld(page, { x: 30, y: 30, z: 0 });
    if (typed) await type(page, "10");
    else {
      const b = await screenOf(page, { x: 10, y: 40, z: 0 });
      await page.mouse.move(b.x, b.y);
      await expect(page.locator(".cursor-hint")).toContainText("Offset 10.00");
      expect((await snapshot(page)).entities).toEqual(before.entities);
      await page.mouse.click(b.x, b.y);
    }
    const after = await snapshot(page),
      inner = Object.values(after.entities).find(
        (e) => e.kind === "face" && !e.holes.length,
      )!;
    if (inner.kind !== "face") throw new Error("Missing inner face");
    const ps = inner.outer
      .map((id) => after.entities[id])
      .filter((e) => e.kind === "vertex")
      .map((e) => e.position);
    expect(await count(page, "face")).toBe(2);
    const applied = Math.min(...ps.map((p) => p.x));
    expect(Math.abs(applied - 10)).toBeLessThan(typed ? 0.0001 : 1);
    expect(Math.max(...ps.map((p) => p.x))).toBeCloseTo(100 - applied, 5);
    expect(Math.min(...ps.map((p) => p.y))).toBeCloseTo(applied, 5);
    expect(Math.max(...ps.map((p) => p.y))).toBeCloseTo(80 - applied, 5);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(before.entities);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    expect((await snapshot(page)).entities).toEqual(after.entities);
    if (typed) {
      await push(page, { x: 50, y: 40, z: 0 }, "20");
      expect(
        Object.values((await snapshot(page)).entities).some(
          (e) => e.kind === "vertex" && Math.abs(e.position.z - 20) < 1e-5,
        ),
      ).toBe(true);
    }
  });
}
test("Offset cuts a vertical cube face, rejects collapsed distances and cancels on Escape", async ({
  page,
}) => {
  await rectangle(page);
  await push(page, { x: 50, y: 50, z: 0 }, "100");
  await page.keyboard.press("f");
  const before = await snapshot(page);
  await page.keyboard.press("o");
  await clickWorld(page, { x: 50, y: 0, z: 50 });
  await type(page, "60");
  await expect(page.getByRole("status")).toContainText("too large");
  expect((await snapshot(page)).entities).toEqual(before.entities);
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(() => window.__gabarito.controller.status().active),
  ).toBe(false);
  await clickWorld(page, { x: 50, y: 0, z: 50 });
  await type(page, "10");
  const after = await snapshot(page),
    newPoints = Object.values(after.entities)
      .filter((e) => !before.entities[e.id])
      .filter((e) => e.kind === "vertex");
  expect(newPoints).toHaveLength(4);
  expect(
    newPoints.every(
      (v) =>
        Math.abs(v.position.y) < 1e-5 &&
        (Math.abs(v.position.x - 10) < 1e-5 ||
          Math.abs(v.position.x - 90) < 1e-5) &&
        (Math.abs(v.position.z - 10) < 1e-5 ||
          Math.abs(v.position.z - 90) < 1e-5),
    ),
  ).toBe(true);
});
