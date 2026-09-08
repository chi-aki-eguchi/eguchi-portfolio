import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoAdminTab } from "./helpers";

test("スマホの写真編集で写真・保存帯・下部ナビが同時に使える", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "スマホの高さと操作を検証");
  await page.setViewportSize({ width: 390, height: 667 });
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  expect((await page.locator(".admin-library-search input").boundingBox())!.width).toBeGreaterThanOrEqual(140);
  await page.locator("[data-library-photo-action]").first().click();
  const inspector = page.locator("[data-library-inspector]");
  const preview = inspector.locator(".admin-inspector-preview img");
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const save = inspector.locator("[data-inspector-save-bar]");
  await expect(save).toContainText("変更なし");
  const barBox = (await save.boundingBox())!;
  const navBox = (await page.locator(".admin-bottom-nav").boundingBox())!;
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y);
  expect((await inspector.locator(".admin-inspector-scroll").boundingBox())!.height).toBeGreaterThan(120);
  await inspector.locator(".admin-inspector-mobile-title input").fill("画面確認のみ");
  await expect(save).toHaveAttribute("data-inspector-save-state", "dirty");
  await save.getByRole("button", { name: "元に戻す" }).click();
  await expect(save).toContainText("変更なし");
  await page.locator("[data-library-inspector-close]").click();
  await expect(inspector).toHaveCount(0);
});

test("設定へ直接進み、目的の言葉で節を探して編集に戻れる", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "スマホの設定入口を検証");
  await loginAsAdmin(page);
  await page.locator("[data-admin-mobile-settings]").click();
  await page.locator(".admin-settings-mobile-current").getByRole("button", { name: /設定項目/ }).click();
  const dialog = page.locator("[data-settings-mobile-section-list]");
  await expect(dialog).toHaveCSS("opacity", "1");
  await dialog.getByRole("searchbox", { name: "設定を検索" }).fill("並び順");
  await dialog.locator('[data-settings-sheet-link="series"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#settings-section-series")).toBeVisible();
  await page.locator(".admin-settings-mobile-current").getByRole("button", { name: /設定項目/ }).click();
  await dialog.getByRole("searchbox").fill("見つからない項目");
  await expect(dialog.getByRole("status")).toContainText("見つかりませんでした");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".admin-settings-mobile-current").getByRole("button", { name: /設定項目/ })).toBeFocused();
});

test("公開スマホの絞り込みはURLと点数を保ち、メニューから戻れる", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "スマホの公開導線を検証");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery?utm_source=ux-check");
  const filters = page.locator(".gallery-mobile-filters__bar");
  await expect(filters).toContainText(/\d+枚/);
  await filters.getByRole("button").click();
  const dialog = page.getByRole("dialog", { name: "写真を探す" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("group", { name: "撮影" }).getByRole("button", { name: "Film", exact: true }).click();
  await expect(page).toHaveURL(/medium=film/);
  await expect(page).toHaveURL(/utm_source=ux-check/);
  await expect(dialog.getByRole("button", { name: "Film", exact: true })).toHaveAttribute("aria-pressed", "true");
  const apiPhotos = await (await page.request.get("/api/photos")).json();
  const settings = await (await page.request.get("/api/settings")).json();
  const filmCount = apiPhotos.photos.filter((photo: { filmType?: string; seriesId?: number }) =>
    photo.filmType === "フィルム" && (settings.galleryExcludeSeries !== "on" || photo.seriesId == null)).length;
  await expect(dialog.getByRole("button", { name: `${filmCount}枚の写真を見る`, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filters.getByRole("button")).toBeFocused();
  await page.locator(".gallery-mobile-filters__selection").getByRole("button", { name: "すべての写真" }).click();
  await expect(page).toHaveURL(/\/gallery\?utm_source=ux-check$/);

  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(page.locator(".site-main")).toHaveAttribute("inert", "");
  await expect(page.locator('#mobile-menu a[href="/gallery"]')).toBeFocused();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("header")))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(page.locator(".site-main")).not.toHaveAttribute("inert");
  await menu.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("#mobile-menu")).toBeHidden();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator(".site-main")).not.toHaveAttribute("inert");
});
