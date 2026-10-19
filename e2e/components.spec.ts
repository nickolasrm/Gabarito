import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Vec3 } from "@gabarito/geometry";
import type { Store } from "@gabarito/core";
import type { Viewport } from "@gabarito/scene";
import type { Controller } from "@gabarito/tools";
declare global {
  interface Window {
    __gabarito: { store: Store; viewport: Viewport; controller: Controller };
  }
}
const state = (page: Page) =>
  page.evaluate(() => window.__gabarito.store.getState());
const components = async (page: Page) =>
  Object.values((await state(page)).entities).filter(
    (e) => e.kind === "component",
  );
async function screen(page: Page, p: Vec3) {
  const q = await page.evaluate(
      (p) => window.__gabarito.viewport.project(p),
      p,
    ),
    b = await page.locator("canvas").boundingBox();
  if (!b) throw Error("No canvas");
  expect(q.visible).toBe(true);
  return { x: q.x + b.x, y: q.y + b.y };
}
async function makePanel(page: Page) {
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  const p = await screen(page, { x: 0, y: 0, z: 0 });
  await page.mouse.click(p.x, p.y);
  await page.keyboard.type("100,100");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^Select/ }).click();
  const center = await screen(page, { x: 50, y: 50, z: 0 });
  await page.mouse.click(center.x, center.y, { clickCount: 3 });
  await page.getByLabel("New component name", { exact: true }).fill("Panel");
  await page
    .getByRole("button", { name: "Make component", exact: true })
    .click();
  await expect(
    page.getByLabel("Component name: Panel", { exact: true }),
  ).toBeVisible();
}
async function seedPanel(page: Page) {
  await page.evaluate(() => {
    const s = window.__gabarito.store,
      p = [
        { x: 0, y: 0, z: 0 },
        { x: 100, y: 0, z: 0 },
        { x: 100, y: 100, z: 0 },
        { x: 0, y: 100, z: 0 },
      ];
    s.execute({ type: "draw", segments: p.map((a, i) => [a, p[(i + 1) % 4]]) });
    s.execute({
      type: "make-component",
      ids: Object.keys(s.getState().entities),
      name: "Panel",
    });
  });
  await expect(
    page.getByLabel("Component name: Panel", { exact: true }),
  ).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
});
test("creates and names a component, selects atomically, enters and exits its context", async ({
  page,
}) => {
  await makePanel(page);
  expect(await components(page)).toHaveLength(1);
  const p = await screen(page, { x: 50, y: 50, z: 0 });
  await page.mouse.click(p.x, p.y);
  expect((await state(page)).selection).toHaveLength(1);
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByLabel("Editing context")).toHaveText("Model / Panel");
  expect(
    Object.values((await state(page)).entities).filter(
      (e) => e.kind === "face",
    ),
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: "Exit component", exact: true })
    .click();
  await expect(page.getByLabel("Editing context")).toHaveText("Model");
  const name = page.getByLabel("Component name: Panel", { exact: true });
  await name.fill("Cabinet");
  await name.press("Enter");
  await expect(
    page.getByLabel("Component name: Cabinet", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByLabel("Component name: Panel", { exact: true }),
  ).toBeVisible();
});
test("sidebar drag previews and drops a linked instance, then a real drawing updates both", async ({
  page,
}) => {
  await seedPanel(page);
  const drag = page.getByRole("button", {
    name: "Drag Panel into scene",
    exact: true,
  });
  const target = await screen(page, { x: 200, y: 0, z: 0 }),
    box = await page.locator("canvas").boundingBox();
  if (!box) throw Error("No canvas");
  await drag.scrollIntoViewIfNeeded();
  const source = await drag.boundingBox();
  if (!source) throw Error("No drag grip");
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.move(target.x + 1, target.y);
  await expect(page.locator(".cursor-hint")).toHaveText("Place Panel");
  expect(await components(page)).toHaveLength(1);
  await page.mouse.up();
  expect(await components(page)).toHaveLength(2);
  const defs = Object.values((await state(page)).definitions);
  expect(defs).toHaveLength(1);
  const p = await screen(page, { x: 50, y: 50, z: 0 });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByLabel("Editing context")).toHaveText("Model / Panel");
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  const a = await screen(page, { x: 20, y: 20, z: 0 });
  await page.mouse.click(a.x, a.y);
  await page.keyboard.type("20,20");
  await page.keyboard.press("Enter");
  expect(
    Object.values((await state(page)).entities).filter(
      (e) => e.kind === "face",
    ),
  ).toHaveLength(2);
  const total = await page.evaluate(
    () =>
      Object.values(window.__gabarito.store.getScene().entities).filter(
        (e) => e.kind === "face",
      ).length,
  );
  expect(total).toBe(4);
  await page
    .getByRole("button", { name: "Exit component", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        Object.values(window.__gabarito.store.getScene().entities).filter(
          (e) => e.kind === "face",
        ).length,
    ),
  ).toBe(2);
});
test("outside drawing uses component snaps without cutting its shared definition", async ({
  page,
}) => {
  await makePanel(page);
  const before = structuredClone((await state(page)).definitions);
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  const p = await screen(page, { x: 0, y: 0, z: 0 });
  await page.mouse.move(p.x, p.y);
  await expect(page.locator(".snap-marker")).toBeVisible();
  await page.mouse.click(p.x, p.y);
  await page.keyboard.type("30,30");
  await page.keyboard.press("Enter");
  expect((await state(page)).definitions).toEqual(before);
  expect(
    Object.values((await state(page)).entities).filter(
      (e) => e.kind === "face",
    ),
  ).toHaveLength(1);
});
test("scale handles and move transform instances; editing a moved clone propagates to the original", async ({
  page,
}) => {
  await makePanel(page);
  await page.getByRole("button", { name: /^Scale/ }).click();
  await expect(
    page.locator(".scale-handle:not([hidden])").first(),
  ).toBeVisible();
  const { definition } = (await components(page))[0];
  await page.evaluate((definition) => {
    window.__gabarito.controller.cancel();
    window.__gabarito.store.execute({
      type: "place-component",
      definition,
      point: { x: 200, y: 0, z: 0 },
    });
    window.__gabarito.viewport.frame();
  }, definition);
  await page.getByRole("button", { name: /^Move/ }).click();
  let p = await screen(page, { x: 250, y: 50, z: 0 });
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.type("50");
  await page.keyboard.press("Enter");
  const moved = (await components(page)).find(
    (e) => e.transform.origin.x === 200,
  )!;
  expect(moved.transform.origin.z).toBe(50);
  await page.getByRole("button", { name: /^Select/ }).click();
  p = await screen(page, { x: 250, y: 50, z: 50 });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByLabel("Editing context")).toHaveText("Model / Panel");
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  p = await screen(page, { x: 220, y: 20, z: 50 });
  await page.mouse.click(p.x, p.y);
  await page.keyboard.type("20,20");
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(
      () =>
        Object.values(window.__gabarito.store.getScene().entities).filter(
          (e) => e.kind === "face",
        ).length,
    ),
  ).toBe(4);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Editing context")).toHaveText("Model");
});

test("cancelling a component drag clears its preview without creating an instance", async ({
  page,
}) => {
  await seedPanel(page);
  const drag = page.getByRole("button", {
    name: "Drag Panel into scene",
    exact: true,
  });
  await drag.scrollIntoViewIfNeeded();
  const source = await drag.boundingBox(),
    target = await screen(page, { x: 200, y: 0, z: 0 });
  if (!source) throw Error("No drag grip");
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.move(target.x + 1, target.y);
  await expect(page.locator(".cursor-hint")).toHaveText("Place Panel");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".cursor-hint")).toBeHidden();
  expect(await components(page)).toHaveLength(1);
});

test("deletes selected scene instances and detects, purges and restores unused definitions", async ({
  page,
}) => {
  await makePanel(page);
  await expect(
    page.getByRole("img", { name: "Preview of Panel", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("img", { name: "Preview of Panel", exact: true })
      .locator("path")
      .first(),
  ).toHaveAttribute("d", /^M/);
  const p = await screen(page, { x: 50, y: 50, z: 0 });
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press("Delete");
  expect(await components(page)).toHaveLength(0);
  await expect(page.getByText("Unused", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Purge unused (1)", exact: true })
    .click();
  await expect(
    page.getByLabel("Component name: Panel", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByLabel("Component name: Panel", { exact: true }),
  ).toBeVisible();
  expect(await components(page)).toHaveLength(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await components(page)).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Purge unused (0)", exact: true }),
  ).toBeDisabled();
});
test("library deletion removes all linked instances and undo restores an active context", async ({
  page,
}) => {
  await makePanel(page);
  const definition = Object.keys((await state(page)).definitions)[0];
  await page.evaluate(
    (definition) =>
      window.__gabarito.store.execute({
        type: "place-component",
        definition,
        point: { x: 200, y: 0, z: 0 },
      }),
    definition,
  );
  const p = await screen(page, { x: 50, y: 50, z: 0 });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByLabel("Editing context")).toHaveText("Model / Panel");
  await page
    .getByRole("button", { name: "Delete component Panel", exact: true })
    .click();
  await expect(page.getByLabel("Editing context")).toHaveText("Model");
  expect(await components(page)).toHaveLength(0);
  await expect(
    page.getByLabel("Component name: Panel", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Editing context")).toHaveText("Model / Panel");
  expect(
    await page.evaluate(
      () =>
        Object.values(window.__gabarito.store.getScene().entities).filter(
          (e) => e.kind === "face",
        ).length,
    ),
  ).toBe(2);
});
test("nested components have previews and highlight with their parent; outside double-click exits", async ({
  page,
}) => {
  await makePanel(page);
  await page.getByLabel("New component name", { exact: true }).fill("Parent");
  await page
    .getByRole("button", { name: "Make component", exact: true })
    .click();
  const parent = (await components(page))[0];
  await page.evaluate((definition) => {
    window.__gabarito.store.execute({
      type: "place-component",
      definition,
      point: { x: 200, y: 0, z: 0 },
    });
    window.__gabarito.viewport.frame();
  }, parent.definition);
  await expect(
    page.getByRole("button", { name: "Purge unused (0)", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("img", { name: "Preview of Parent", exact: true })
      .locator("path")
      .first(),
  ).toHaveAttribute("d", /^M/);
  let p = await screen(page, { x: 50, y: 50, z: 0 });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByLabel("Editing context")).toHaveText("Model / Parent");
  const active = await page.evaluate(() => {
    const scene = window.__gabarito.store.getScene(),
      path = window.__gabarito.store.getContext().path;
    const face = Object.values(scene.entities).find(
      (e) => e.kind === "face" && e.id.startsWith(path.join("/") + "/"),
    )!;
    return !scene.inactive.includes(face.id);
  });
  expect(active).toBe(true);
  const before = await state(page),
    highlight = page.getByRole("button", {
      name: "Highlight components",
      exact: true,
    });
  await highlight.click();
  await expect(highlight).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-highlight-components",
    "true",
  );
  expect(await state(page)).toEqual(before);
  await highlight.click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-highlight-components",
    "false",
  );
  p = await screen(page, { x: 250, y: 50, z: 0 });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByLabel("Editing context")).toHaveText("Model");
  p = await screen(page, { x: 50, y: 50, z: 0 });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByLabel("Editing context")).toHaveText("Model / Parent");
  p = await screen(page, { x: 200, y: -100, z: 0 });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByLabel("Editing context")).toHaveText("Model");
});
