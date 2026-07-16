import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

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
});
