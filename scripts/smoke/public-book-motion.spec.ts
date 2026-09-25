import { test, expect, type Page } from "./fixtures.ts";

/**
 * 写真集の骨格（siteDesign = "book"）の動き（2026-09-25）。
 *
 * 1. 現像: 頁が画面に入ると写真が濃くなる。**どの写真も隠れたまま残らない。**
 *    写真を待たせる印（`data-develop="wait"`）が付いたまま画面にあると、
 *    写真集なのに写真が見えない。
 * 2. ビューアの開閉: 頁の写真の「影」が運ばれ、閉じたあとに影が残らない。
 *    ビューアの中で先へ送ってから閉じると、その写真の頁へ戻る。
 * 3. 動きを減らす設定: 影は運ばない（移動なので）。現像の濃淡は残す。
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
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, vh * 0.8);
    // 現像（濃淡 1.1s）が終わるまで待ってから数える。
    await page.waitForTimeout(1800);
    expect(await hiddenInView(page), `${i + 1}回目のスクロールで写真が隠れたまま`).toBe(0);
  }
}

test("写真集 › 頁の写真は現像されて、隠れたまま残らない", async ({ page }) => {
  await openAsBook(page, "/series/harbour-light");
  await page.waitForTimeout(2000);
  expect(await hiddenInView(page)).toBe(0);
  await readThrough(page);
});

test("写真集 › ビューアは頁の写真から開き、送った先の頁へ戻る", async ({ page }) => {
  await openAsBook(page, "/series/harbour-light#p-03");
  await page.waitForTimeout(2000);
  await page.locator("#p-03 [data-photo-tile]").click();
  await page.waitForTimeout(200);
  expect(await page.locator("dialog .lb-ghost").count(), "開く途中で影が運ばれていない").toBe(1);
  await page.waitForTimeout(1600);
  expect(await page.locator(".lb-ghost").count(), "開き終えても影が残っている").toBe(0);
  await expect(page.locator("dialog .lb-content")).toHaveCSS("opacity", "1");

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(await page.locator(".lb-ghost").count(), "閉じたあとに影が残っている").toBe(0);
  const top = await page.evaluate(() =>
    Math.round(document.getElementById("p-05")!.getBoundingClientRect().top),
  );
  expect(top, "送った先（5枚目）の頁へ戻っていない").toBeLessThanOrEqual(60);
  expect(top).toBeGreaterThanOrEqual(-2);
});

test.describe("動きを減らす設定", () => {
  test.use({ reducedMotion: "reduce" });

  test("写真集 › 影は運ばず、現像の濃淡は残る", async ({ page }) => {
    await openAsBook(page, "/series/harbour-light");
    await page.waitForTimeout(2000);
    // 次の頁の写真が濃くなっていく途中を拾う（濃淡の transition が 0 でない）。
    const duration = await page.evaluate(() => {
      const img = document.querySelector<HTMLElement>(".book-page .book-photo img");
      return img ? getComputedStyle(img).transitionDuration : "";
    });
    expect(parseFloat(duration), `現像の濃淡が消えている: ${duration}`).toBeGreaterThan(0.3);
    await readThrough(page);

    await page.locator(".book-page [data-photo-tile]").first().click();
    await page.waitForTimeout(150);
    expect(await page.locator(".lb-ghost").count(), "動きを減らす設定で影が動いた").toBe(0);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });
});
