import { expect, test } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

// Language selection is browser-only state. This test changes localStorage and
// signs in, but never clicks Save/Delete/Add or any other data-writing action.
test.describe("admin — JP/EN shared shell", () => {
  test("EN survives reload and is shared by login and the admin shell", async ({
    page,
  }, testInfo) => {
    await page.goto("/admin/login");
    const loginToggle = page.locator("[data-admin-language-toggle]:visible");
    await expect(loginToggle).toHaveAttribute("data-language", "ja");
    await expect(page.locator('input[type="password"]')).toHaveAttribute(
      "placeholder",
      "パスワード",
    );

    await loginToggle.getByRole("button", { name: "EN" }).click();
    await expect(page.locator('input[type="password"]')).toHaveAttribute(
      "placeholder",
      "Password",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("admin:language")),
    ).toBe("en");

    await page.reload();
    await expect(
      page.locator("[data-admin-language-toggle]:visible"),
    ).toHaveAttribute("data-language", "en");
    await loginAsAdmin(page);

    const shellToggle = page.locator(
      "[data-admin-language-toggle]:visible",
    );
    await expect(shellToggle).toHaveAttribute("data-language", "en");
    if (testInfo.project.name === "desktop") {
      const groups = page.locator(".admin-sidebar__group-title");
      await expect(groups).toContainText(["Photos", "Presentation", "Site"]);
      await expect(
        page.locator(".admin-sidebar").getByRole("button", {
          name: "Getting started",
        }),
      ).toBeVisible();
    } else {
      const nav = page.locator(".admin-bottom-nav");
      await expect(nav.getByRole("button", { name: /Photos/ })).toBeVisible();
      await expect(
        nav.getByRole("button", { name: /Presentation/ }),
      ).toBeVisible();
      await expect(nav.getByRole("button", { name: /Site/ })).toBeVisible();
    }

    await shellToggle.getByRole("button", { name: "JP" }).click();
    await page.reload();
    await expect(
      page.locator("[data-admin-language-toggle]:visible"),
    ).toHaveAttribute("data-language", "ja");
  });

  test("Phase 2b translates Library, Categories, and Series without writes", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.evaluate(() => localStorage.setItem("admin:language", "en"));

    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") {
        writes.push(`${request.method()} ${request.url()}`);
      }
    });

    await gotoAdminTab(page, "gallery");
    await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
    await page.locator(".admin-library-view-menu > summary").click();
    await expect(page.getByLabel("Sort Library view")).toBeVisible();
    const importMedium = page.getByLabel("Import medium");
    await expect(importMedium).toContainText("Import as");
    await expect(importMedium).toContainText("Digital");
    await expect(importMedium).toContainText("Film");

    await gotoAdminTab(page, "categories");
    await expect(
      page.getByText("Used as Gallery filters", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("New Category", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Category name")).toBeVisible();

    await gotoAdminTab(page, "series");
    await expect(page.getByText("New Series", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Manage groups of work", { exact: false }),
    ).toBeVisible();
    await expect(page.getByLabel("New series title")).toBeVisible();

    await gotoAdminTab(page, "settings");
    // 2c-3で設定タブ「基本・見た目」もEN化されたため、境界マーカーをEN表記に更新。
    await expect(
      page.locator(
        '[data-settings-section="site-basics"] [data-settings-section-heading]',
      ),
    ).toContainText("Site Basics");
    expect(writes).toEqual([]);
  });
});
