import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";
import { chooseSettingsSection, loginAsAdmin } from "./helpers";

/**
 * 管理画面はサイトの骨格（写真中心／いつもの構成）に関係なく同じ形（2026-09-29）。
 *
 * 以前は骨格を切り替えると管理画面ごと別物（左の縦メニューの黒い画面）に入れ替わり、
 * オーナーが「何がどこにあるのか分からない」と困った。ここで縛るのは:
 * - 上の入口（写真・シリーズ・サイト）と、サイトの画面のページ・全体の見た目・そのほかが、
 *   どちらの骨格でも同じ
 * - 右の一覧はそのページに実際にある部分だけ。今の骨格で使わない設定も「探す」で開け、
 *   使わないと一言添える
 * - スマホは一覧と設定を1画面ずつ出し、戻れる（押せる大きさ 44px）
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
          body: JSON.stringify({ ...settings, siteDesign, setupCompleted: "true" }),
        }),
  );
  await loginAsAdmin(page);
  await page.evaluate(() => {
    localStorage.setItem("admin:site:mode", JSON.stringify("page"));
    localStorage.setItem("admin:site:page", JSON.stringify("top"));
    localStorage.setItem("admin:site:part", "null");
  });
  await page.goto("/admin");
  await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
  await expect(page.locator(".se-parts [data-site-part]").first()).toBeVisible();
}

async function frameLabels(page: Page) {
  return {
    pages: await page.locator("[data-site-page]").allTextContents(),
    modes: await page.locator("[data-site-mode]").allTextContents(),
  };
}

async function listed(page: Page) {
  return page.locator(".se-parts [data-site-part]").evaluateAll((items) =>
    items.map((el) => (el as HTMLElement).dataset.sitePart),
  );
}

test.describe("admin — 骨格を切り替えても管理画面は同じ", () => {
  test("入口・ページ・全体の見た目が同じで、使わない設定も探せば開ける", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "一覧の中身はPC幅で比べる");
    await openSite(page, api, "classic");
    const tabs = await page.locator(".admin-book__tab").allTextContents();
    const classicFrame = await frameLabels(page);
    const classicTop = await listed(page);
    await expect(page.locator("aside.admin-sidebar")).toHaveCount(0);

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openSite(page, api, "book");
    expect(await page.locator(".admin-book__tab").allTextContents()).toEqual(tabs);
    expect(await frameLabels(page)).toEqual(classicFrame);
    const bookTop = await listed(page);

    expect(tabs).toEqual(["写真", "シリーズ", "サイト"]);
    expect(classicFrame.pages).toEqual(["トップ", "Gallery", "Series", "About", "Contact"]);
    // 同じ部分は同じ順。いつもの構成にだけある部分（作品の並び・シリーズの帯）は写真中心では出ない。
    expect(classicTop).toEqual(expect.arrayContaining(["name", "top-photos", "works", "series-strip", "menu", "footer"]));
    expect(bookTop).toEqual(classicTop.filter((id) => id !== "works" && id !== "series-strip"));

    // 写真中心で使わない設定（いつもの構成のトップ）も、探せば開けて、使わないと一言添える。
    await chooseSettingsSection(page, "hero");
    await expect(page.locator(".admin-book-unused")).toContainText("写真中心の構成では");
  });

  test("PCはプレビューが左、設定が右に並ぶ", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PC幅の並び");
    await openSite(page, api, "classic");
    await page.locator('[data-site-mode="look"]').click();
    await page.locator('[data-site-part="fonts"]').click();
    await expect(page.locator('[data-settings-section="fonts"]')).toBeVisible();
    await expect(page.locator(".se-part-head__title")).toHaveText("書体");
    const preview = await page.locator(".studio-preview-frame").boundingBox();
    const form = await page.locator('[data-settings-section="fonts"]').boundingBox();
    expect(preview && form && preview.x + preview.width <= form.x).toBe(true);
    // プレビューの操作は下の1本の帯だけ。
    await expect(page.locator(".studio-preview-float")).toBeVisible();
    await expect(page.locator(".studio-preview-toolbar")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("スマホは一覧と設定を1画面ずつ出し、一覧へ戻れる", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "スマホ幅の並び");
    await openSite(page, api, "classic");
    const list = page.locator(".se-parts");
    const back = page.locator(".se-part-head__back");
    await expect(list).toBeVisible();
    await expect(back).toHaveCount(0);

    await page.locator('[data-site-page="about"]').click();
    const item = page.locator('[data-site-part="about-layout"]');
    expect((await item.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await item.click();
    await expect(page.locator('[data-settings-section="page-parts"]')).toBeVisible();
    await expect(list).toHaveCount(0);
    await expect(back).toBeVisible();
    await expect(back).toContainText("About");
    expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    // 設定の中の「設定項目」一覧は、右の一覧と重なるので出さない。
    await expect(page.locator(".admin-settings-mobile-current > button[aria-expanded]")).toBeHidden();

    await back.click();
    await expect(list).toBeVisible();

    // 「サイト」をもう一度押しても一覧へ戻る。
    await item.click();
    await expect(back).toBeVisible();
    await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
    await expect(list).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
