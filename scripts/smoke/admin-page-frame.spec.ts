import { test, expect } from "@playwright/test";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

// Photo workspaces use compact headings; Settings names the current section
// beside its preview. Each tab must still identify itself visibly, inside the
// content area, without reserving an oversized heading above the photographs.
for (const width of [1440, 1024, 375]) {
  test(`admin — ${width}pxで全9タブの現在地が画面内に表示される`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== (width === 375 ? "mobile" : "desktop"));
    await page.setViewportSize({ width, height: 900 });
    await loginAsAdmin(page);
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      const heading = tab === "settings"
        ? page.locator(".admin-settings-mobile-current__label")
        : page.locator("h1.admin-page-header__title");
      await expect(heading, `${tab}の現在地`).toBeVisible();
      await expect(heading).toBeInViewport();
      const box = await heading.boundingBox();
      const content = await page.locator(".admin-content").boundingBox();
      expect(box).not.toBeNull();
      expect(content).not.toBeNull();
      expect(box!.x, `${tab}の左余白`).toBeGreaterThanOrEqual(content!.x + 8);
      expect(box!.x, `${tab}の左余白`).toBeLessThanOrEqual(content!.x + 40);
      expect(box!.x + box!.width).toBeLessThanOrEqual(content!.x + content!.width);
      expect(box!.height, `${tab}の見出しが縦積みにならない`).toBeLessThanOrEqual(44);
    }
    if (width >= 1024) {
      await page.getByRole("button", { name: "プレビューを閉じる", exact: true }).click();
      await expect(page.locator(".admin-settings-mobile-current__label")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "設定項目", exact: true })).toBeVisible();
    }
  });
}
