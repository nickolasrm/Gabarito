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
  await clickWorld(page, p);
  await type(page, distance);
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
