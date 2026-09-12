import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoAdminTab } from "./helpers";

test("絞り込みの閉じる・結果・追加条件に届き、写真へ戻れる", async ({ page }) => {
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  await expect(page.locator("[data-library-photo-action]").first()).toBeVisible();
  const trigger = page.locator("[data-library-filters-toggle]");
  const grid = page.locator("[data-library-scroll]");
  const before = (await grid.boundingBox())!;
  await trigger.click();
  const panel = page.locator("[data-library-filter-sheet]");
  await expect(panel).toHaveCSS("opacity", "1");
  const box = (await panel.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  if (viewport.width >= 1100) {
    const after = (await grid.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(after.x + 1);
    expect(after.height).toBeGreaterThanOrEqual(before.height - 80);
    expect((await page.locator(".admin-library-search input").boundingBox())!.width).toBeGreaterThan(180);
    expect(after.width).toBeGreaterThan(600);
  } else {
    expect(box.height).toBeLessThanOrEqual(viewport.height * .77);
    for (let index = 0; index < 10; index++) {
      await page.keyboard.press("Tab");
      expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
  }
  await panel.getByRole("combobox", { name: "媒体で絞り込み" }).selectOption("film");
  await panel.getByText("その他の条件", { exact: true }).click();
  await panel.getByRole("combobox", { name: "公開状態で絞り込み" }).selectOption("published");
  await panel.locator(".admin-filter-body").evaluate(el => { el.scrollTop = el.scrollHeight; });
  const close = panel.getByRole("button", { name: "絞り込みを閉じる" });
  const result = panel.getByRole("button", { name: /枚の写真を見る/ });
  await expect(close).toBeInViewport();
  await expect(result).toBeInViewport();
  await result.click();
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger.locator("[data-library-filter-count]")).toHaveText("2");
  await trigger.click();
  await panel.getByRole("button", { name: "すべて解除" }).click();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger.locator("[data-library-filter-count]")).toHaveCount(0);
});

test("写真を大きく見て編集し、未保存内容を保護して一覧の位置へ戻る", async ({ page }) => {
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  await expect(page.locator("[data-library-photo-action]").first()).toBeVisible();
  const scroll = page.locator("[data-library-scroll]");
  await scroll.evaluate(el => { el.scrollTop = 200; });
  const photo = page.locator("[data-library-photo-action]").filter({ visible: true }).first();
  await photo.click();
  const top = await scroll.evaluate(el => el.scrollTop);
  const editor = page.locator("[data-library-inspector]");
  const image = editor.locator(".admin-inspector-preview img");
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 15000 }).toBeGreaterThan(0);
  await expect(editor.getByRole("button", { name: "写真の詳細を閉じる" })).toBeFocused();
  const imageBox = (await image.boundingBox())!;
  if (page.viewportSize()!.width >= 1100) {
    expect(imageBox.width).toBeGreaterThan(600);
    expect(imageBox.height).toBeGreaterThan(400);
  }
  const title = editor.locator(".admin-inspector-mobile-title input");
  await title.fill("未保存の作業を保持");
  await editor.getByRole("button", { name: "写真を大きく見る", exact: true }).click();
  const preview = page.locator(".admin-library-photo-preview");
  await expect(preview).toHaveCSS("opacity", "1");
  expect((await preview.locator("[data-library-preview-image]").boundingBox())!.height).toBeGreaterThan(page.viewportSize()!.height * .7);
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(title).toHaveValue("未保存の作業を保持");
  await editor.getByRole("button", { name: "次の写真", exact: true }).click();
  const confirm = page.locator("dialog[open]");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(title).toHaveValue("未保存の作業を保持");
  await title.press("Escape");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "キャンセル", exact: true }).click();
  await editor.locator("[data-inspector-save-bar]").getByRole("button", { name: "元に戻す" }).click();
  await editor.getByRole("button", { name: "写真の詳細を閉じる" }).focus();
  await page.keyboard.press("Enter");
  await expect(editor).toHaveCount(0);
  await expect(scroll).toBeVisible();
  expect(await scroll.evaluate(el => el.scrollTop)).toBeCloseTo(top, 0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.hasAttribute("data-library-photo-action"))).toBe(true);
});

test("小さい画面からPC幅へ変えてもパネルと背景の操作が復帰する", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  await expect(page.locator("[data-library-photo-action]").first()).toBeVisible();
  await page.locator("[data-library-filters-toggle]").click();
  await expect(page.locator("dialog[data-library-filter-sheet]")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator("aside[data-library-filter-sheet]")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page.setViewportSize({ width: 320, height: 568 });
  const panel = page.locator("dialog[data-library-filter-sheet]");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "絞り込みを閉じる" }).click();
  await expect(page.locator("[data-library-filters-toggle]")).toBeFocused();
  await page.locator("[data-library-photo-action]").first().click();
  const editor = page.locator("[data-library-inspector]");
  const footer = editor.locator("[data-inspector-save-bar]");
  await expect(footer.getByRole("button", { name: "保存", exact: true })).toBeInViewport();
  const box = (await footer.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual((await page.locator(".admin-bottom-nav").boundingBox())!.y + 1);
  expect((await editor.locator(".admin-inspector-scroll").boundingBox())!.height).toBeGreaterThan(100);
  await editor.getByRole("button", { name: "写真の詳細を閉じる" }).click();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
