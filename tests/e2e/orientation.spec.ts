import { test, expect } from "@playwright/test";

const aid = "40000000-0000-4000-8000-000000000001";

test("first visit explains demo access, dismisses, remembers, and replays", async ({
  page,
}) => {
  // The first authenticated route initializes PGlite and compiles on cold CI.
  test.setTimeout(90_000);
  await page.goto("/login");
  const tour = page.getByRole("dialog");
  await expect(tour).toBeVisible();
  await expect(tour).toContainText("any Google account");
  await expect(tour).toContainText("program staff approve access");
  await page.keyboard.press("Escape");
  await expect(tour).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Quick tour", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(500); // Beyond the automatic tour delay.
  await expect(tour).not.toBeVisible();
  await page.getByRole("button", { name: "Quick tour", exact: true }).click();
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Got it" }).click();
  await page
    .getByRole("button", { name: "Enter as Maya · Tutor", exact: true })
    .click();
  await page.waitForURL("**/tutor");
  await expect(tour).toContainText("Your students", { timeout: 30_000 });
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour).toContainText("Your monthly totals");
  await tour.getByRole("button", { name: "Back", exact: true }).click();
  await expect(tour).toContainText("Your students");
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await page.locator(".student-link").first().click();
  await page.waitForURL(`**/tutor/assignments/${aid}`);
  await expect(tour).toContainText("Record tutoring time", { timeout: 30_000 });
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await expect(
    page.getByRole("button", { name: "Save session", exact: true }),
  ).toBeEnabled();
});

for (const width of [1280, 375, 320]) {
  test(`all tour steps fit at ${width}px, trap focus, and leave forms usable`, async ({
    page,
  }) => {
    // Each viewport gets its own budget, including cold dev-server compilation.
    test.setTimeout(90_000);
    await page.goto("/login");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Got it" })
      .click();
    await page
      .getByRole("button", { name: "Enter as Sam · Staff", exact: true })
      .click();
    await page.waitForURL("**/staff");
    await expect(page.locator(".page-heading h1")).toBeVisible();
    const height = width === 320 ? 568 : 812;
    await page.setViewportSize({ width, height });
    for (const route of [
      "/staff",
      "/staff/people",
      "/staff/reports",
      `/tutor/assignments/${aid}`,
      "/demo",
    ]) {
      await page.goto(route);
      const tour = page.getByRole("dialog");
      await page.waitForTimeout(500);
      if (!(await tour.isVisible()))
        await page
          .getByRole("button", { name: "Quick tour", exact: true })
          .click();
      while (await tour.isVisible()) {
        const box = await page.locator(".tour-bubble").boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
        const ring = await page.locator(".tour-highlight").boundingBox();
        if (ring) {
          const overlap =
            box!.x < ring.x + ring.width &&
            box!.x + box!.width > ring.x &&
            box!.y < ring.y + ring.height &&
            box!.y + box!.height > ring.y;
          expect(
            overlap,
            `Tour obscures its target at ${width}px on ${route}`,
          ).toBe(false);
        }
        await page.keyboard.press("Tab");
        expect(
          await tour.evaluate((el) => el.contains(document.activeElement)),
        ).toBe(true);
        const next = tour.getByRole("button", { name: "Next", exact: true });
        if (await next.count()) await next.click();
        else await tour.getByRole("button", { name: "Got it" }).click();
      }
    }
  });
}

test("opening and dismissing the login tour keeps the page stationary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1510, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("gather:tour:v1:demo-login", "done"),
  );
  await page.goto("/login");
  const before = await page.locator(".login-story").boundingBox();
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await page.getByRole("button", { name: "Quick tour", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.locator(".login-story").boundingBox()).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    height,
  );
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
