import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";

/**
 * 写真中心のサイト（siteDesign = "book"、2026-09-26 作り直し）。
 *
 * 1. トップを開くと表紙（大きな名前と「トップの最初に並べる」写真）。その下に写真の段。
 *    写真は元の縦横比のまま（切り抜かない・引き伸ばさない）、段は横幅いっぱいにそろい、
 *    横はみ出しが無い
 * 2. 器（名前とメニュー）は揃ってから一度だけ現れ、そのあと動かない
 *    （オーナー 2026-09-26「チラチラ動くのがうるさい」）
 * 3. 写真を押すとビューアが開き、閉じられる
 * 4. シリーズの一覧とシリーズのページ。1枚が2本のシリーズに入っていれば両方に出る
 * 5. /gallery はトップへ（絞り込みを持ったまま）
 *
 * 人工データのサイトの設定だけを book に差し替えて見る。
 */
async function openAsPhotoSite(page: Page, api: SmokeApi, path: string) {
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...settings, siteDesign: "book" }),
    }),
  );
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.locator(".ps-site")).toBeVisible();
}

function noSideScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
}

/** 画面に見えている写真の、枠の比と写真の比の差（最大）。 */
function worstRatioGap(page: Page) {
  return page.evaluate(() => {
    let worst = 0;
    for (const img of document.querySelectorAll<HTMLImageElement>(".ps-tile__img, .ps-cover__img")) {
      if (!img.complete || !img.naturalWidth) continue;
      const r = img.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width < 10) continue;
      const box = r.width / r.height;
      const photo = img.naturalWidth / img.naturalHeight;
      worst = Math.max(worst, Math.abs(box - photo) / photo);
    }
    return worst;
  });
}

test("写真中心 › トップは表紙から始まり、写真は元の比のまま並ぶ", async ({ page, api }) => {
  await openAsPhotoSite(page, api, "/");
  // 表紙: 名前と写真が最初の画面に収まる。
  const cover = page.locator(".ps-cover");
  await expect(cover.locator("h1")).toHaveText("Smoke Fixture Studio");
  const photo = await page.locator(".ps-cover__photo").boundingBox();
  const vh = page.viewportSize()!.height;
  expect(photo!.y + photo!.height).toBeLessThanOrEqual(vh + 1);
  // 「トップの最初に並べる」写真が3枚あるので、送れる。
  await expect(page.locator(".ps-cover__nav")).toContainText("01 / 03");
  await page.locator(".ps-cover__nav").getByRole("button", { name: "次の写真" }).click();
  await expect(page.locator(".ps-cover__nav")).toContainText("02 / 03");
  // その下に写真の段。
  await page.getByRole("button", { name: /Photographs/ }).click();
  const tiles = page.locator(".ps-tile");
  await expect(tiles.first()).toBeInViewport();
  expect(await tiles.count()).toBeGreaterThan(5);
  // 表紙の写真は、絞り込んでいない一覧には重ねない。
  for (const id of [7001, 7101, 7601]) await expect(page.locator(`[data-photo-tile="${id}"]`)).toHaveCount(0);
  await page.waitForTimeout(1500);
  // 比の差 2% 未満（段の丸めだけ）。切り抜き・引き伸ばしがあればここで落ちる。
  expect(await worstRatioGap(page)).toBeLessThan(0.02);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  // 段の右端がそろう（最後の段以外）。
  const rightEdges = await page.evaluate(() => {
    const byTop = new Map<number, number>();
    for (const el of document.querySelectorAll<HTMLElement>(".ps-tile")) {
      const r = el.getBoundingClientRect();
      const top = Math.round(r.top);
      byTop.set(top, Math.max(byTop.get(top) ?? 0, r.right));
    }
    return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, right]) => right);
  });
  const full = rightEdges.slice(0, -1);
  expect(Math.max(...full) - Math.min(...full)).toBeLessThan(2);
});

test("写真中心 › 器は一度だけ現れ、そのあと動かない", async ({ page, api }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __nav: string[] };
    w.__nav = [];
    const tick = () => {
      const bar = document.querySelector<HTMLElement>(".ps-header__bar");
      if (bar?.hasAttribute("data-ready")) {
        const items = [...bar.querySelectorAll<HTMLElement>("a, button")]
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => `${el.textContent?.trim()}@${Math.round(el.getBoundingClientRect().left)}`)
          .join("|");
        if (w.__nav[w.__nav.length - 1]?.split(" [")[0] !== items) {
          const nav = bar.querySelector(".ps-nav")!.getBoundingClientRect();
          const widths = [...bar.querySelectorAll<HTMLElement>(".ps-nav li")].map((li) => li.getBoundingClientRect().width.toFixed(1)).join(",");
          w.__nav.push(`${items} [doc=${document.documentElement.clientWidth} bar=${bar.getBoundingClientRect().width.toFixed(1)} nav=${nav.left.toFixed(1)}+${nav.width.toFixed(1)} li=${widths}]`);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openAsPhotoSite(page, api, "/");
  await page.waitForTimeout(2500);
  const states = await page.evaluate(() => (window as unknown as { __nav: string[] }).__nav);
  expect(states.length, `現れたあとにメニューが組み替わった: ${states.join(" → ")}`).toBe(1);
});

test("写真中心 › 写真を押すとビューアが開き、閉じられる", async ({ page, api }) => {
  await openAsPhotoSite(page, api, "/");
  const tile = page.locator(".ps-tile__button").nth(2);
  await tile.click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 5000 });
});

test("写真中心 › シリーズの一覧とページ。2本に入った写真は両方に出る", async ({ page, api }) => {
  await openAsPhotoSite(page, api, "/series");
  const entries = page.locator(".ps-series-entry__link");
  await expect(entries.first()).toBeVisible();
  const hrefs = await entries.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs).toContain("/series/harbour-light");
  expect(hrefs).toContain("/series/long-title");
  // 写真のない組・非公開の組は出さない
  expect(hrefs).not.toContain("/series/empty-series");
  expect(hrefs).not.toContain("/series/draft-series");
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);

  await page.goto("/series/harbour-light", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toHaveText("港の光");
  await expect(page.locator('[data-photo-tile="7101"]')).toHaveCount(1);
  await page.goto("/series/long-title", { waitUntil: "networkidle" });
  await expect(page.locator('[data-photo-tile="7101"]')).toHaveCount(1);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
});

test("写真中心 › /gallery は絞り込みを持ったままトップへ", async ({ page, api }) => {
  await openAsPhotoSite(page, api, "/gallery?medium=film");
  await expect(page).toHaveURL(/\/\?medium=film$/);
  await expect(page.locator(".ps-filters a", { hasText: "Film" })).toHaveAttribute("aria-current", "true");
});
