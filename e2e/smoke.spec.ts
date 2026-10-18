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
test("boots with all seven tools and creates exact typed geometry with undo/redo", async ({
  page,
}) => {
  for (const name of [
    "Select",
    "Line",
    "Rectangle",
    "Tape Measure",
    "Move",
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
test("a stationary push/pull click is a no-op", async ({ page }) => {
  await rectangle(page);
  const before = await snapshot(page);
  await page.getByRole("button", { name: /^Push\/Pull/ }).click();
  await clickWorld(page, { x: 50, y: 50, z: 0 });
  expect(await snapshot(page)).toEqual(before);
  await expect(page.getByRole("status")).toHaveText("Hold a face to start");
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
  await expect(page.locator(".cursor-hint")).toHaveText("50.00 mm");
  await page.getByLabel("Display and input units").selectOption("cm");
  await expect(page.locator(".cursor-hint")).toHaveText("5.00 cm");
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
  await page.mouse.move(b.x, b.y);
  await expect(page.locator(".cursor-hint")).toHaveText("50.00 mm");
  expect(await count(page, "guide")).toBe(0);
  await page.mouse.up();
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
        await page
          .locator("canvas")
          .dispatchEvent("pointercancel", {
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
