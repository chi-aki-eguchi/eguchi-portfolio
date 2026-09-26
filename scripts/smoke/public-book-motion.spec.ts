import { test, expect, type Page } from "./fixtures.ts";
import { loginAsAdmin } from "./helpers";

/**
 * 写真集の骨格（siteDesign = "book"、2026-09-25 見直し）。
 *
 * 1. トップ: 画面いっぱいの写真 → Works → Photos。現像（写真が画面に入ると
 *    濃くなる）で、**どの写真も隠れたまま残らない。**
 * 2. Photos の写真からビューアが開き（影が運ばれる）、閉じたあとに影が残らない。
 * 3. 作品ページ: 番地の写真から開き、→ で送ると番地も進む。Index のコマで
 *    その写真へ。最後の次は奥付。
 * 4. 動きを減らす設定: 影は運ばない（移動なので）。現像の濃淡は残す。
 * 5. 横はみ出しが無い。
 *
 * 人工データのサイトの設定だけを book に差し替えて見る。
 */
async function openAsBook(page: Page, path: string) {
  await page.route("**/api/settings**", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: { ...json, siteDesign: "book" } });
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.locator(".book").first()).toBeVisible();
}

/** 画面に見えているのに、まだ隠されている写真の数。 */
function hiddenInView(page: Page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>('.book-photo[data-develop="wait"]')].filter(
        (el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight * 0.85;
        },
      ).length,
  );
}

async function readThrough(page: Page) {
  const vh = page.viewportSize()?.height ?? 800;
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, vh * 0.8);
    // 現像（濃淡 1.1s）が終わるまで待ってから数える。
    await page.waitForTimeout(1800);
    expect(await hiddenInView(page), `${i + 1}回目のスクロールで写真が隠れたまま`).toBe(0);
  }
}

function noSideScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
}

test("写真集 › トップは写真から始まり、どの写真も隠れたまま残らない", async ({ page }) => {
  await openAsBook(page, "/");
  await expect(page.locator(".bk-hero__slide[data-active] img")).toBeVisible();
  const hero = await page.locator(".bk-hero").boundingBox();
  const vh = page.viewportSize()!.height;
  expect(hero!.height, "最初の写真が画面いっぱいではない").toBeGreaterThanOrEqual(vh - 1);
  expect(hero!.y).toBeLessThanOrEqual(0);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await readThrough(page);
});

test("写真集 › Photos の写真からビューアが開き、影を残さず閉じる", async ({ page }) => {
  await openAsBook(page, "/");
  const tile = page.locator(".bk-field [data-photo-tile]").first();
  await tile.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await tile.click();
  await page.waitForTimeout(200);
  expect(await page.locator("dialog .lb-ghost").count(), "開く途中で影が運ばれていない").toBe(1);
  await page.waitForTimeout(1600);
  expect(await page.locator(".lb-ghost").count(), "開き終えても影が残っている").toBe(0);
  await expect(page.locator("dialog .lb-content")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(await page.locator(".lb-ghost").count(), "閉じたあとに影が残っている").toBe(0);
});

test("写真集 › 作品ページは1枚ずつ送り、Index と奥付へ行ける", async ({ page }) => {
  await openAsBook(page, "/series/harbour-light#p-03");
  const count = page.locator(".bk-bar__count");
  await expect(count).toHaveText(/^03(–\d\d)? \/ 06$/);
  await page.keyboard.press("ArrowRight");
  await expect(count).not.toHaveText(/^03 /);
  expect(page.url()).toMatch(/#p-0[4-6]$/);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Index" }).click();
  await page.locator('.book-frame__link[href="#p-01"]').click();
  await expect(count).toHaveText(/^01(–\d\d)? \/ 06$/);
  await expect(page.locator(".bk-sheet")).toHaveCount(0);

  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bk-colophon")).toBeVisible();
  await expect(count).toHaveText("— / 06");
});

test.describe("動きを減らす設定", () => {
  test("写真集 › 影は運ばず、現像の濃淡は残る", async ({ page }) => {
    // `test.use({ reducedMotion })` はこの fixture の context に届かない
    // （2026-09-25 実測で matchMedia が false のままだった）。ページで直接指定する。
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openAsBook(page, "/");
    const duration = await page.evaluate(() => {
      const img = document.querySelector<HTMLElement>(".bk-field .book-photo img, .bk-work .book-photo img");
      return img ? getComputedStyle(img).transitionDuration : "";
    });
    expect(parseFloat(duration), `現像の濃淡が消えている: ${duration}`).toBeGreaterThan(0.3);
    await readThrough(page);

    const tile = page.locator(".bk-field [data-photo-tile]").first();
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    await page.waitForTimeout(150);
    expect(await page.locator(".lb-ghost").count(), "動きを減らす設定で影が動いた").toBe(0);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });
});

test("写真集 › 管理画面の作品ページの並べ方に、写真集で使わない設定を書く", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "管理画面の案内は PC 幅で1度見れば足りる");
  await page.route("**/api/settings**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: { ...json, siteDesign: "book" } });
  });
  await loginAsAdmin(page);
  await page.getByRole("navigation", { name: "管理画面の入口" }).getByRole("button", { name: "サイト" }).click();
  await page.getByRole("button", { name: /作品ページの並べ方/ }).click();
  const note = page.locator(".admin-book-unused");
  await expect(note).toBeVisible();
  await expect(note).toContainText("Photos はいつもすべての公開写真");
  await page.screenshot({ path: process.env.BOOK_ADMIN_SHOT || testInfo.outputPath("admin-book-series-note.png") });
  // 写真集でも使う節には出さない。
  await page.getByRole("button", { name: /背景と配色/ }).click();
  await expect(note).toHaveCount(0);
});
