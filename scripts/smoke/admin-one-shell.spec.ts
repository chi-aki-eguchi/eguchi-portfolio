import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";
import { loginAsAdmin } from "./helpers";

/**
 * 管理画面はサイトの骨格（写真中心／いつもの構成）に関係なく同じ形（2026-09-29）。
 *
 * 以前は骨格を切り替えると管理画面ごと別物（左の縦メニューの黒い画面）に入れ替わり、
 * オーナーが「何がどこにあるのか分からない」と困った。ここで縛るのは:
 * - 上の入口（写真・シリーズ・サイト）とサイトの目次が、どちらの骨格でも同じ項目・同じ順
 * - 今の骨格で使わない項目は隠さず、札を付けて薄くするだけ
 * - スマホは目次と中身を1画面ずつ出し、「← サイトの一覧」で戻れる（押せる大きさ 44px）
 *
 * 読み取りだけ。設定の読み込みを差し替えて骨格を切り替え、保存は押さない。
 */

async function openSite(page: Page, api: SmokeApi, siteDesign: "classic" | "book") {
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.request().method() !== "GET"
      ? route.fallback()
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...settings, siteDesign }),
        }),
  );
  await loginAsAdmin(page);
  await page.goto("/admin");
  await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
  await expect(page.locator("[data-site-item]").first()).toBeVisible();
}

async function outline(page: Page) {
  return page.locator("[data-site-item]").evaluateAll((items) =>
    items.map((el) => ({
      id: (el as HTMLElement).dataset.siteItem,
      inactive: el.hasAttribute("data-skeleton-inactive"),
    })),
  );
}

test.describe("admin — 骨格を切り替えても管理画面は同じ", () => {
  test("入口とサイトの目次が同じで、使わない項目は薄くなるだけ", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "目次の中身はPC幅で比べる");
    await openSite(page, api, "classic");
    const tabs = await page.locator(".admin-book__tab").allTextContents();
    const classic = await outline(page);
    await expect(page.locator("aside.admin-sidebar")).toHaveCount(0);

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openSite(page, api, "book");
    expect(await page.locator(".admin-book__tab").allTextContents()).toEqual(tabs);
    const book = await outline(page);

    expect(tabs).toEqual(["写真", "シリーズ", "サイト"]);
    expect(book.map((item) => item.id)).toEqual(classic.map((item) => item.id));
    expect(classic.filter((item) => item.inactive)).toEqual([]);
    expect(book.filter((item) => item.inactive).map((item) => item.id)).toEqual(
      expect.arrayContaining(["settings:hero", "settings:gallery-layout", "settings:navigation"]),
    );

    // 薄くした項目も開けて、今は使わないと一言添える。
    await page.locator('[data-site-item="settings:hero"]').click();
    await expect(page.locator('[data-settings-section="hero"]')).toBeVisible();
    await expect(page.locator(".admin-book-unused")).toContainText("写真中心の構成では");
  });

  test("PCは目次と中身が並び、戻るボタンは出ない", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PC幅の並び");
    await openSite(page, api, "classic");
    await page.locator('[data-site-item="settings:fonts"]').click();
    await expect(page.locator('[data-settings-section="fonts"]')).toBeVisible();
    await expect(page.locator(".book-site__toc")).toBeVisible();
    await expect(page.locator(".book-site__back")).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("スマホは目次と中身を1画面ずつ出し、一覧へ戻れる", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "スマホ幅の並び");
    await openSite(page, api, "classic");
    const toc = page.locator(".book-site__toc");
    const back = page.locator(".book-site__back");
    await expect(toc).toBeVisible();
    await expect(back).toBeHidden();

    const item = page.locator('[data-site-item="settings:page-parts"]');
    expect((await item.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await item.click();
    await expect(page.locator('[data-settings-section="page-parts"]')).toBeVisible();
    await expect(toc).toBeHidden();
    await expect(back).toBeVisible();
    await expect(back).toContainText("About・Contact の組み方");
    expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    // 設定の中の「設定項目」一覧は、目次と重なるので出さない。
    await expect(page.locator(".admin-settings-mobile-current > button[aria-expanded]")).toBeHidden();

    await back.click();
    await expect(toc).toBeVisible();
    await expect(back).toBeHidden();

    // 「サイト」をもう一度押しても目次へ戻る。
    await item.click();
    await expect(back).toBeVisible();
    await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
    await expect(toc).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
