import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * The app exposes a dev-only handle so these tests can assert real document state
 * instead of guessing from pixels. Production builds strip it.
 */
interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

interface DebugEntity {
  kind: string;
  points?: string[];
  position?: WorldPoint;
}

interface DebugState {
  entities: Record<string, DebugEntity>;
  settings: { unit: string; snapping: boolean; circleSegments: number };
  selection: string[];
}

interface DebugHandle {
  store: { getState(): DebugState };
  viewport: { worldToScreen(point: WorldPoint): { x: number; y: number } };
  controller: { getStatus(): { active: boolean } };
  activeTool: () => string;
}

declare global {
  interface Window {
    __gabarito?: DebugHandle;
  }
}

const errors = new WeakMap<Page, string[]>();

async function snapshot(page: Page): Promise<DebugState> {
  const state = await page.evaluate(() => window.__gabarito?.store.getState() as DebugState | undefined);
  if (!state) throw new Error("dev debug handle missing");
  return state;
}

function count(state: DebugState, kind: string): number {
  return Object.values(state.entities).filter((entity) => entity.kind === kind).length;
}

function positions(state: DebugState): WorldPoint[] {
  return Object.values(state.entities)
    .filter((entity) => entity.kind === "point")
    .map((entity) => entity.position as WorldPoint);
}

/** Screen position of a world point, accounting for the canvas offset in the page. */
async function screenOf(page: Page, world: WorldPoint): Promise<{ x: number; y: number }> {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  const projected = await page.evaluate((point) => window.__gabarito!.viewport.worldToScreen(point), world);
  const screen = { x: box.x + projected.x, y: box.y + projected.y };
  // Off-canvas points would silently miss the viewport and make a test pass for the
  // wrong reason, so refuse to click them.
  if (
    screen.x < box.x + 2 ||
    screen.x > box.x + box.width - 2 ||
    screen.y < box.y + 2 ||
    screen.y > box.y + box.height - 2
  ) {
    throw new Error(`world point ${JSON.stringify(world)} projects outside the canvas: ${JSON.stringify(screen)}`);
  }
  return screen;
}

/**
 * Click at a point expressed in world coordinates, so the resulting geometry is
 * deterministic. Clicking raw pixel positions is tempting but the inference engine
 * legitimately snaps a click that lands on an inferred axis, which collapses the test
 * rectangle to a line.
 */
async function clickWorld(page: Page, world: WorldPoint): Promise<void> {
  const screen = await screenOf(page, world);
  await page.mouse.click(screen.x, screen.y);
}

/** A 3000 × 3000 square centred on the origin, off both world axes. */
const SQUARE_A: WorldPoint = { x: -1500, y: -1500, z: 0 };
const SQUARE_B: WorldPoint = { x: 1500, y: 1500, z: 0 };

async function drawRectangle(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, SQUARE_A);
  await clickWorld(page, SQUARE_B);
}

test.beforeEach(async ({ page }) => {
  const collected: string[] = [];
  errors.set(page, collected);
  page.on("pageerror", (error) => collected.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") collected.push(`console: ${message.text()}`);
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
});

test("boots cleanly and lists every tool", async ({ page }) => {
  for (const label of [
    "Select",
    "Line",
    "Rectangle",
    "Circle",
    "Push\\/Pull",
    "Move",
    "Rotate",
    "Ruler",
    "Measure",
  ]) {
    await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
  }
  await page.waitForTimeout(400);
  expect(errors.get(page)).toEqual([]);
});

test("draws a rectangle from two clicks and undoes it", async ({ page }) => {
  await drawRectangle(page);

  const drawn = await snapshot(page);
  expect(count(drawn, "face")).toBe(1);
  expect(count(drawn, "edge")).toBe(4);
  expect(count(drawn, "point")).toBe(4);

  const points = positions(drawn);
  expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(-1500, 0);
  expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(1500, 0);

  await page.getByRole("button", { name: "Undo" }).click();
  expect(count(await snapshot(page), "face")).toBe(0);
  expect(errors.get(page)).toEqual([]);
});

test("a typed size in metres produces the right geometry", async ({ page }) => {
  await page.getByLabel(/Display and input/).selectOption("m");
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.type("100,50");
  await expect(page.locator(".typed-input")).toHaveValue("100,50");
  await page.keyboard.press("Enter");

  const state = await snapshot(page);
  expect(count(state, "face")).toBe(1);
  const points = positions(state);
  const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  const depth = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
  expect(width).toBeCloseTo(100_000, 0);
  expect(depth).toBeCloseTo(50_000, 0);
  expect(errors.get(page)).toEqual([]);
});

test("changes the unit without touching stored geometry", async ({ page }) => {
  await drawRectangle(page);
  const before = await snapshot(page);
  await page.getByLabel(/Display and input/).selectOption("ft");
  const after = await snapshot(page);
  expect(JSON.stringify(after.entities)).toBe(JSON.stringify(before.entities));
  expect(after.settings.unit).toBe("ft");
});

test("snapping can be turned off", async ({ page }) => {
  await page.getByLabel(/Snap to geometry/).uncheck();
  expect((await snapshot(page)).settings.snapping).toBe(false);
  await page.getByLabel(/Snap to geometry/).check();
  expect((await snapshot(page)).settings.snapping).toBe(true);
});

test("pushes a face into a solid", async ({ page }) => {
  await drawRectangle(page);

  await page.getByRole("button", { name: /Push\/Pull/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.type("500");
  await page.keyboard.press("Enter");

  const state = await snapshot(page);
  expect(count(state, "face")).toBe(6);
  expect(count(state, "point")).toBe(8);
  const heights = positions(state).map((point) => point.z);
  expect(Math.max(...heights)).toBeCloseTo(500, 3);
  expect(errors.get(page)).toEqual([]);
});

test("pins an axis with the arrow keys and moves by a typed distance", async ({ page }) => {
  await drawRectangle(page);
  const before = Math.min(...positions(await snapshot(page)).map((point) => point.x));

  await page.getByRole("button", { name: /^Move/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".chip.axis")).toContainText("X (red)");

  await page.keyboard.type("250");
  await page.keyboard.press("Enter");

  const after = Math.min(...positions(await snapshot(page)).map((point) => point.x));
  expect(after - before).toBeCloseTo(250, 3);
  expect(errors.get(page)).toEqual([]);
});

test("rotates the selection by a typed angle", async ({ page }) => {
  await drawRectangle(page);

  await page.getByRole("button", { name: /^Select/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  expect((await snapshot(page)).selection).toHaveLength(1);

  await page.getByRole("button", { name: /^Rotate/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.type("45");
  await page.keyboard.press("Enter");

  const state = await snapshot(page);
  expect(count(state, "face")).toBe(1);
  const points = positions(state);
  // A 3000 square rotated 45° about its centre spans 3000·√2 across both axes.
  expect(Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))).toBeCloseTo(4242.64, 1);
  expect(errors.get(page)).toEqual([]);
});

test("draws a guide with the ruler and a dimension with measure", async ({ page }) => {
  await page.getByRole("button", { name: /^Ruler/ }).click();
  await clickWorld(page, { x: -1200, y: -1200, z: 0 });
  await clickWorld(page, { x: 1200, y: -1200, z: 0 });

  await page.getByRole("button", { name: /Measure/ }).click();
  await clickWorld(page, { x: -800, y: -800, z: 0 });
  await clickWorld(page, { x: -800, y: 800, z: 0 });

  const state = await snapshot(page);
  expect(count(state, "guide")).toBe(1);
  expect(count(state, "dimension")).toBe(1);
  await expect(page.locator(".label")).toHaveCount(1);
  expect(errors.get(page)).toEqual([]);
});

test("draws a tessellated circle and shows its face", async ({ page }) => {
  await page.getByRole("button", { name: /^Circle/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.type("1000");
  await page.keyboard.press("Enter");

  const state = await snapshot(page);
  expect(count(state, "face")).toBe(1);
  expect(count(state, "edge")).toBe(state.settings.circleSegments);
  expect(count(state, "point")).toBe(state.settings.circleSegments);
});

test("cancels an operation with Escape", async ({ page }) => {
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, SQUARE_A);
  await page.keyboard.press("Escape");
  await clickWorld(page, SQUARE_B);

  expect(count(await snapshot(page), "edge")).toBe(0);
});

// Regression tests for the six reported bugs.

test("closes a face when three lines form a triangle", async ({ page }) => {
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, { x: -1000, y: -1000, z: 0 });
  await clickWorld(page, { x: 1000, y: -1000, z: 0 });
  await clickWorld(page, { x: 0, y: 1000, z: 0 });
  await clickWorld(page, { x: -1000, y: -1000, z: 0 });

  const state = await snapshot(page);
  expect(count(state, "face")).toBe(1);
  expect(count(state, "edge")).toBe(3);
  expect(count(state, "point")).toBe(3);
});

test("shows a crosshair for drawing tools and an arrow for select", async ({ page }) => {
  const cursor = () => page.evaluate(() => document.querySelector("canvas")?.style.cursor ?? "");
  await page.getByRole("button", { name: /^Select/ }).click();
  expect(await cursor()).toBe("default");
  await page.getByRole("button", { name: /^Line/ }).click();
  expect(await cursor()).toBe("crosshair");
  await page.getByRole("button", { name: /Push\/Pull/ }).click();
  expect(await cursor()).toBe("ns-resize");
});

test("a pinned Z axis makes a vertical rectangle", async ({ page }) => {
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".chip.axis")).toContainText("Z (blue)");

  // Drag diagonally in screen space, the way a user draws in a vertical plane.
  const start = await screenOf(page, { x: 0, y: 0, z: 0 });
  await page.mouse.move(start.x + 60, start.y - 60);
  await page.mouse.move(start.x + 160, start.y - 200);
  expect(await page.locator(".readout").textContent()).not.toContain("0 × 0");
  await page.mouse.click(start.x + 160, start.y - 200);

  const state = await snapshot(page);
  expect(count(state, "face")).toBe(1);
  const zs = positions(state).map((point) => point.z);
  expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1);
});

test("draws a vertical edge when Z is pinned", async ({ page }) => {
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.press("ArrowUp");
  const start = await screenOf(page, { x: 0, y: 0, z: 0 });
  await page.mouse.move(start.x, start.y - 150);
  await page.mouse.click(start.x, start.y - 150);

  const state = await snapshot(page);
  expect(count(state, "edge")).toBe(1);
  const zs = positions(state).map((point) => point.z);
  expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1);
});

test("pushes a face into a solid by dragging it", async ({ page }) => {
  await drawRectangle(page);

  await page.getByRole("button", { name: /Push\/Pull/ }).click();
  const centre = await screenOf(page, { x: 0, y: 0, z: 0 });
  await page.mouse.click(centre.x, centre.y);
  await page.mouse.move(centre.x, centre.y - 40);
  await page.mouse.move(centre.x, centre.y - 180);
  expect(await page.locator(".readout").textContent()).not.toContain("0 mm");
  await page.mouse.click(centre.x, centre.y - 180);

  const state = await snapshot(page);
  expect(count(state, "face")).toBe(6);
  expect(count(state, "point")).toBe(8);
});

// Second round of reported bugs.

test("selects the innermost face when rectangles are nested", async ({ page }) => {
  await page.getByRole("button", { name: /^Rectangle/ }).click();
  await clickWorld(page, { x: -2000, y: -2000, z: 0 });
  await page.keyboard.type("4000");
  await page.keyboard.press("Enter");
  await clickWorld(page, { x: -700, y: -700, z: 0 });
  await page.keyboard.type("1400");
  await page.keyboard.press("Enter");

  const areas = await page.evaluate(() => {
    const s = window.__gabarito!.store.getState();
    return Object.entries(s.entities)
      .filter(([, entity]) => entity.kind === "face")
      .map(([id, entity]) => {
        const pts = (entity.points ?? []).map((pointId) => s.entities[pointId].position!);
        let sum = 0;
        for (let i = 0; i < pts.length; i += 1) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          sum += a.x * b.y - b.x * a.y;
        }
        return { id, area: Math.round(Math.abs(sum / 2)) };
      });
  });
  expect(areas).toHaveLength(2);

  await page.getByRole("button", { name: /^Select/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 }); // centre of the inner rectangle

  const selected = await page.evaluate(() => {
    const s = window.__gabarito!.store.getState();
    const face = s.entities[s.selection[0]];
    const pts = (face?.points ?? []).map((id) => s.entities[id].position!);
    let sum = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.round(Math.abs(sum / 2));
  });
  expect(selected).toBe(1_960_000); // 1400 x 1400, the inner one
});

test("draws a vertical edge with no arrow key held", async ({ page }) => {
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, { x: 0, y: 0, z: 0 });
  const start = await screenOf(page, { x: 0, y: 0, z: 0 });
  await page.mouse.move(start.x, start.y - 60);
  await page.mouse.move(start.x, start.y - 150);
  await expect(page.locator(".chip.snap")).toContainText("Z axis");
  await page.mouse.click(start.x, start.y - 150);

  const state = await snapshot(page);
  expect(count(state, "edge")).toBe(1);
  const zs = positions(state).map((point) => point.z);
  expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1);
});

test("stops drawing once an edge closes a face", async ({ page }) => {
  await page.getByRole("button", { name: /^Line/ }).click();
  await clickWorld(page, { x: -1200, y: -800, z: 0 });
  await clickWorld(page, { x: 0, y: -800, z: 0 });
  await clickWorld(page, { x: -600, y: 200, z: 0 });
  await expect(page.locator(".statusbar .status-tool")).toHaveText("Line");

  // Before the closing click the operation is live; after it, the tool is idle again.
  const liveBefore = await page.evaluate(() => window.__gabarito!.controller.getStatus().active);
  expect(liveBefore).toBe(true);
  await clickWorld(page, { x: -1200, y: -800, z: 0 });

  const state = await snapshot(page);
  expect(count(state, "face")).toBe(1);
  const liveAfter = await page.evaluate(() => window.__gabarito!.controller.getStatus().active);
  expect(liveAfter).toBe(false);
});
