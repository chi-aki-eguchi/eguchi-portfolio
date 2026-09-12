import { expect, test, type Page } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

const count = (page: Page) => page.locator("[data-library-selection-toolbar]");
const photo = (page: Page, index: number) => page.locator(`#admin-photo-${91000 + index} [data-library-photo-action]`);

async function openFixture(page: Page) {
  await page.route("**/api/photos?**", (route) => route.fulfill({ json: { photos: Array.from({ length: 120 }, (_, i) => ({
    id: 91000 + i, title: `${i < 10 ? "Keep" : "Other"} ${i}`, filename: `selection-${i}.jpg`,
    url: "/selection-fixture.svg", thumbUrl: "/selection-fixture.svg", width: 1500, height: 1000,
    sortOrder: i, isPublished: true, displaySize: "M", rotation: 0, focalX: .5, focalY: .5,
  })) } }));
  await page.route("**/selection-fixture.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100"><path fill="#8a8782" d="M0 0h150v100H0z"/></svg>' }));
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  await expect(photo(page, 0)).toBeVisible();
  await page.locator('[data-library-mode-action="select"]:visible, [data-library-mobile-select]:visible').first().click();
}

test("ボタンで画面外を含む全選択と解除、絞り込み外の選択を保持", async ({ page }) => {
  await openFixture(page);
  await page.locator("[data-library-select-all]").click();
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "120");
  if (page.viewportSize()!.width < 768) {
    for (const selector of ["[data-batch-cat]", "[data-batch-series]"]) {
      const group = page.locator(selector);
      const trigger = group.locator(":scope > button");
      await trigger.click();
      const menu = group.locator(":scope > div");
      await expect(menu).toBeVisible();
      const bounds = (await menu.boundingBox())!;
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual((await trigger.boundingBox())!.y);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await trigger.click();
    }
    const toolbar = (await count(page).boundingBox())!;
    const scroll = page.locator("[data-library-scroll]");
    const bounds = (await scroll.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(toolbar.y + 1);
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(photo(page, 119)).toBeInViewport();
    await photo(page, 119).click();
    await expect(count(page)).toHaveAttribute("data-library-selected-count", "119");
  }
  await page.locator("[data-library-clear-selection]").click();
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "0");
  // Select a photo outside the next filter without changing production data.
  await page.locator("[data-library-search-input]").fill("Other 10");
  await photo(page, 10).click();
  await page.locator("[data-library-search-input]").fill("Keep");
  await expect(photo(page, 0)).toBeVisible();
  await expect(count(page)).toContainText(/うち1枚は絞り込みの外|1 outside filters/);
  await page.locator("[data-library-select-all]").click();
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "11");
  await page.locator("[data-library-clear-selection]").click();
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("Shiftクリックはフォーカス移動で起点を失わず、範囲を拡大・縮小できる", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "キーボードの範囲選択");
  await openFixture(page);
  await photo(page, 0).click();
  await photo(page, 5).click({ modifiers: ["Shift"] });
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "6");
  await photo(page, 2).click({ modifiers: ["Shift"] });
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "3");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "4");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "3");
  await photo(page, 8).click({ modifiers: ["ControlOrMeta"] });
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "4");
  await photo(page, 10).click({ modifiers: ["Shift"] });
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "6");
  await page.locator('[data-library-mode-action="select"]:visible').click();
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "6");
  await photo(page, 10).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".admin-library-photo-preview")).toBeVisible();
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "6");
  await page.keyboard.press("Space");
  await expect(page.locator(".admin-library-photo-preview")).toHaveCount(0);
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "6");
});

test("全選択ショートカットと解除、検索入力中は文字選択を維持", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "キーボード操作");
  await openFixture(page);
  await photo(page, 0).click();
  await page.keyboard.press("ControlOrMeta+a");
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "120");
  await page.keyboard.press("ControlOrMeta+Shift+a");
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "0");
  const search = page.locator("[data-library-search-input]");
  await search.fill("Keep");
  await search.press("ControlOrMeta+a");
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "0");
  expect(await search.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!)).toBe(4);
});

test("仮想表示の画面外までShiftで範囲選択できる", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "仮想表示をまたぐ範囲選択");
  await openFixture(page);
  await photo(page, 0).click();
  await page.locator("[data-library-scroll]").evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(photo(page, 119)).toBeVisible();
  await photo(page, 119).click({ modifiers: ["Shift"] });
  await expect(count(page)).toHaveAttribute("data-library-selected-count", "120");
});
