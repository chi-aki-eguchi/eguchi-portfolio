import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";
import { SITE_DESIGNS } from "./site-design.ts";
import { loginAsAdmin } from "./helpers";

/**
 * 管理画面「サイト」は、公開サイトを大きく見ながら、変えたい所を押して直す（2026-09-29）。
 *
 * プレビューの中の「どの要素がどの部分か」は `lib/admin-preview-pick.ts` が公開サイトの
 * class 名で持つ。公開サイトの形を変えると、ここで押せる所が黙って消える。ここで縛るのは:
 * - 両方の骨格の各ページで、主な部分がプレビューの中に見つかる
 * - プレビューの中を押すと、その部分の設定だけが右に出る（ページは移らない）
 * - 右の一覧に乗ると、プレビューのその部分に枠が付く
 *
 * 読み取りだけ。設定の読み込みを差し替えて骨格を切り替え、保存は押さない。
 */

type Design = "classic" | "book";

async function openSite(page: Page, api: SmokeApi, siteDesign: Design) {
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
    localStorage.setItem("admin:book:view", JSON.stringify("site"));
    localStorage.setItem("admin:site:mode", JSON.stringify("page"));
    localStorage.setItem("admin:site:page", JSON.stringify("top"));
    localStorage.setItem("admin:site:part", "null");
  });
  await page.goto("/admin");
  await expect(page.locator(".se-parts [data-site-part]").first()).toBeVisible();
}

const preview = (page: Page) => page.frameLocator(".studio-preview-frame iframe");

async function foundParts(page: Page) {
  return preview(page)
    .locator("[data-edit]")
    .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("data-edit")))]);
}

// 人工データで必ず見つかる部分。作家の言葉・撮影のご依頼は設定しだいで出ないので数えない。
const EXPECTED: Record<Design, Record<string, string[]>> = {
  book: {
    top: ["name", "top-photos", "menu", "footer"],
    gallery: ["page-title", "order", "menu", "footer"],
    series: ["page-title", "order", "menu", "footer"],
    about: ["about", "page-title", "menu", "footer"],
    contact: ["contact-info", "page-title", "menu", "footer"],
  },
  classic: {
    top: ["name", "top-photos", "works", "series-strip", "menu", "footer"],
    gallery: ["page-title", "gallery-photos", "menu", "footer"],
    series: ["page-title", "series-cards", "menu", "footer"],
    about: ["about", "page-title", "menu", "footer"],
    contact: ["contact-info", "page-title", "menu", "footer"],
  },
};

test.describe("admin — サイトを見ながら直す", () => {
  for (const design of SITE_DESIGNS) {
    test(`${design}: 各ページの主な部分がプレビューの中で押せる`, async ({ page, api }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "プレビューを横に出すPC幅で確かめる");
      test.setTimeout(90_000);
      await openSite(page, api, design);
      for (const [pageId, expected] of Object.entries(EXPECTED[design])) {
        await page.locator(`[data-site-page="${pageId}"]`).click();
        await expect
          .poll(() => foundParts(page), { message: `${design} ${pageId} で見つかる部分`, timeout: 15_000 })
          .toEqual(expect.arrayContaining(expected));
        // 見つかった部分は、右の一覧にも出ている。メニュー・フッター・見出しはどのページにも
        // 出るので一覧には並べず「全体の見た目」に1回だけ置く（プレビューの中では押せる）。
        const listed = await page.locator(".se-parts [data-site-part]").evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-site-part")),
        );
        const pageOnly = expected.filter((id) => !["menu", "footer", "page-title"].includes(id));
        expect(listed, `${design} ${pageId} の一覧`).toEqual(expect.arrayContaining(pageOnly));
      }
    });
  }

  test("プレビューの中を押すと、その部分の設定が右に出る", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "プレビューを横に出すPC幅で確かめる");
    await openSite(page, api, "classic");
    const frameUrl = () => page.locator(".studio-preview-frame iframe").evaluate((el) => (el as HTMLIFrameElement).contentWindow?.location.pathname);
    await expect.poll(() => foundParts(page), { timeout: 15_000 }).toContain("name");

    // 名前は大きな文字。乗ると「名前を変える」の札が出る。
    const name = preview(page).locator('[data-edit="name"]').first();
    await name.hover();
    await expect(preview(page).locator("#admin-preview-pick-chip")).toHaveText("名前を変える");
    await name.click();
    await expect(page.locator(".se-part-head__title")).toHaveText("名前");
    await expect(page.locator('[data-settings-section="name"]')).toBeVisible();
    await expect(preview(page).locator('[data-edit="name"][data-admin-selected]').first()).toBeAttached();

    // メニューの中の Gallery を押しても、ページは移らずメニューの設定が開く。
    await preview(page).locator("header nav a", { hasText: "Gallery" }).first().click();
    await expect(page.locator(".se-part-head__title")).toHaveText("メニュー");
    expect(await frameUrl()).toBe("/");

    // 戻って一覧の行に乗ると、プレビューのその部分に枠が付く。
    await page.locator(".se-part-head__back").click();
    await page.locator('[data-site-mode="look"]').click();
    await page.locator('.se-parts [data-site-part="footer"]').hover();
    await expect(preview(page).locator('[data-edit="footer"][data-admin-selected]').first()).toBeAttached();
  });

  // 2026-10-01: 一覧から部分を選ぶと、プレビューの中をその部分まで送る。以前は
  // scrollIntoView が iframe の外（管理画面の枠）まで送り、Safari ではプレビューが
  // 枠の中で上へずれて、下の4割が白いまま残っていた。送るのはプレビューの中だけ。
  test("一覧から部分を選んでも、プレビューは枠からずれない", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "プレビューを横に出すPC幅で確かめる");
    await openSite(page, api, "classic");
    await expect.poll(() => foundParts(page), { timeout: 15_000 }).toContain("name");
    const offset = () =>
      page.locator(".studio-preview-frame").evaluate((frame) => {
        const iframe = frame.querySelector("iframe");
        if (!iframe) return null;
        return Math.round(iframe.getBoundingClientRect().top - frame.getBoundingClientRect().top);
      });
    const before = await offset();
    // フッターはどのページにも出るので「全体の見た目」の一覧にある。
    await page.locator('[data-site-mode="look"]').click();
    await page.locator('.se-parts [data-site-part="footer"]').click();
    await expect(page.locator(".se-part-head__title")).toHaveText("フッター");
    // プレビューの中は送られている（フッターはページの最後）
    await expect
      .poll(() => preview(page).locator("body").evaluate(() => window.scrollY), { timeout: 10_000 })
      .toBeGreaterThan(100);
    expect(await offset(), "iframe が枠の中でずれた").toBe(before);
  });
});
