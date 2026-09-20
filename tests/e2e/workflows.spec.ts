import { test, expect, type Page } from "@playwright/test";
const aid = "40000000-0000-4000-8000-000000000001";
async function login(page: Page, who = "Maya · Tutor") {
  await page.goto("/login");
  await page.getByRole("button", { name: `Enter as ${who}` }).click();
  await page.waitForURL(who.includes("Staff") ? "**/staff" : "**/tutor");
  await expect(page.locator(".page-heading h1")).toBeVisible();
}
test("tutor records attendance, staff finds it in the downloaded report", async ({
  page,
}) => {
  await login(page);
  await page
    .locator(".student-card")
    .filter({ hasText: "Ana Morales" })
    .getByRole("link", { name: "View & record sessions" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Record a session" }),
  ).toBeVisible();
  await page.getByLabel("Session date").fill("2026-08-20");
  await page.getByLabel("Duration (minutes)").fill("37");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await login(page, "Sam · Staff");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Monthly reports", exact: true })
    .click();
  await page.waitForURL("**/staff/reports");
  await page.getByLabel("Month", { exact: true }).fill("2026-08");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "August 2026" }),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Session detail CSV" }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c);
  const csv = Buffer.concat(chunks).toString();
  expect(csv).toContain("2026-08-20");
  expect(csv).toContain(",37,");
  expect(csv).toContain("Ana Morales");
});
test("correction updates monthly hours without a confirmation step", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/tutor/assignments/${aid}?month=2026-08`);
  await page.getByLabel("Session date").fill("2026-08-21");
  await page.getByLabel("Duration (minutes)").fill("41");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  await page.reload();
  await expect(
    page.getByText("Attendance status", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Confirm attendance/ }),
  ).toHaveCount(0);
  const event = page.locator(".event-row").filter({ hasText: "Aug 21, 2026" });
  await event.getByText("Edit entry", { exact: true }).click();
  await event
    .getByRole("spinbutton", { name: "Minutes", exact: true })
    .fill("38");
  await event.getByRole("button", { name: "Save correction" }).click();
  await expect(event.getByRole("status")).toContainText("Saved successfully");
  await expect(event).toContainText("38");
});
test("pending and tutor cannot access staff exports or another assignment", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Preview pending access" }).click();
  await expect(
    page.getByRole("heading", { name: "Awaiting approval" }),
  ).toBeVisible();
  expect(
    (
      await page.request.get(
        "/api/reports/attendance.csv?term_id=30000000-0000-4000-8000-000000000001&month=2026-08",
      )
    ).status(),
  ).toBe(401);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await login(page);
  expect(
    (
      await page.request.get(
        "/api/reports/attendance.csv?term_id=30000000-0000-4000-8000-000000000001&month=2026-08",
      )
    ).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await login(page, "Leo · Tutor");
  await page.goto(`/tutor/assignments/${aid}`);
  await expect(
    page.getByRole("heading", { name: "Record unavailable" }),
  ).toBeVisible();
});
test("staff adds a student and assignment through real forms", async ({
  page,
}) => {
  await login(page, "Sam · Staff");
  await page
    .getByRole("link", { name: "People & assignments", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Student name", exact: true })
    .fill("Elena Example");
  await page.getByRole("button", { name: "Add student", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Elena Example", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Student", exact: true })
    .selectOption({ label: "Elena Example" });
  await page
    .getByRole("combobox", { name: "Tutor", exact: true })
    .selectOption({ label: "Maya Patel" });
  await page.getByRole("button", { name: "Create assignment" }).click();
  await expect(
    page.locator(".directory-item").filter({ hasText: "Elena Example" }),
  ).toContainText("Maya Patel");
});
test("tutor records an achievement and staff exports it once", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/tutor/assignments/${aid}`);
  await page.getByText("+ Record an achievement", { exact: true }).click();
  await page.getByLabel("Goal attained").selectOption("C5");
  await page
    .getByRole("textbox", { name: "Date attained", exact: true })
    .fill("2026-08-15");
  await page
    .getByRole("button", { name: "Save achievement", exact: true })
    .click();
  await expect(page.locator(".achievement")).toContainText(
    "Read to child(ren)",
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await login(page, "Sam · Staff");
  const r = await page.request.get(
    "/api/reports/achievements.csv?term_id=30000000-0000-4000-8000-000000000001&month=2026-08",
  );
  expect(r.ok()).toBeTruthy();
  expect((await r.text()).match(/Read to child/g)).toHaveLength(1);
});
test("mobile and desktop pages have no viewport overflow or runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "Sam · Staff");
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/staff",
      "/staff/people",
      "/staff/reports",
      `/tutor/assignments/${aid}`,
    ]) {
      await page.goto(route);
      await expect(page.locator(".page-heading h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("an interrupted save preserves form values and safely retries", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/tutor/assignments/${aid}?month=2026-08`);
  await page.getByLabel("Session date").fill("2026-08-22");
  await page.getByLabel("Duration (minutes)").fill("23");
  let interrupted = false;
  await page.route("**/tutor/assignments/**", async (route) => {
    if (!interrupted && route.request().method() === "POST") {
      interrupted = true;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "connection was interrupted" }),
  ).toBeVisible();
  await expect(page.getByLabel("Duration (minutes)")).toHaveValue("23");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  await expect(
    page.locator(".event-row").filter({ hasText: "Aug 22, 2026" }),
  ).toHaveCount(1);
});

test("tutor month filtering stays compact and staff activity details remain available", async ({
  page,
}) => {
  await login(page);
  // The earlier staff workflow adds Elena; the original three examples remain present.
  for (const student of ["Ana Morales", "Ben Park", "Clara Nguyen"])
    await expect(
      page.locator(".student-card").filter({ hasText: student }),
    ).toBeVisible();
  await page.goto(`/tutor/assignments/${aid}?month=2026-09`);
  await expect(page.locator(".activity-calendar")).toHaveCount(0);
  await page.getByLabel("Month", { exact: true }).selectOption("2026-08");
  await expect(
    page.getByRole("button", { name: "View", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue(
    "2026-08",
  );

  await expect(page.getByText("Close the loop", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Report stopped tutoring", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await login(page, "Sam · Staff");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveCount(2);
  await page.getByLabel("Month", { exact: true }).selectOption("2026-09");
  const staffDay = page.locator(".activity-calendar").getByRole("button", {
    name: "Sep 10, 2026: 2.25 hours, 2 sessions",
    exact: true,
  });
  await expect(staffDay).toHaveClass(/intensity-2/);
  await staffDay.hover();
  const detail = page.locator(".activity-day-details");
  await expect(detail).toContainText("Maya Patel → Ana Morales");
  await expect(detail).toContainText("Maya Patel → Ben Park");
  await expect(detail).toContainText("45 min");
  await page.setViewportSize({ width: 375, height: 844 });
  await page.getByRole("button", { name: /Sep 1, 2026:/ }).click();
  await expect(detail).toContainText("No sessions recorded");
});

test("staff returns to Activity summary, jumps to current month, and exports without completeness", async ({
  page,
}) => {
  await login(page, "Sam · Staff");
  await page
    .getByRole("link", { name: "People & assignments", exact: true })
    .click();
  await page.waitForURL("**/staff/people");
  await page
    .getByRole("link", { name: "Back to Activity summary", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Activity summary", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Month", { exact: true }).selectOption("2026-07");
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue(
    "2026-07",
  );
  await page
    .getByRole("button", { name: "Current month", exact: true })
    .click();
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue(
    "2026-09",
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Monthly reports", exact: true })
    .click();
  await page.waitForURL("**/staff/reports");
  await expect(page.getByText("Completeness", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Attendance confirmed", { exact: true }),
  ).toHaveCount(0);
  const result = await page.request.get(
    "/api/reports/attendance.csv?term_id=30000000-0000-4000-8000-000000000001&month=2026-09&status=confirmed",
  );
  expect(result.ok()).toBeTruthy();
  const csv = await result.text();
  expect(csv).not.toMatch(/confirmation_status|confirmed_at|confirmed_by/);
  expect(csv).toContain("Ana Morales");
});
