import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";

/**
 * 新しい構成（siteDesign = "develop"、2026-10-10 第1段階）。
 *
 * 1. 何もしなければ今までの構成のまま（メニューも、`/portrait` が無いことも）
 * 2. 住所に `?design=develop` を付けたタブだけ、新しい構成になる：
 *    メニューが Portrait／Life／Series／Info、トップが表紙と扉の目次
 * 3. Portrait／Life は分類から写真が出て、押すといつものビューアが開く
 * 4. Info は自己紹介と依頼（今までの About と Contact の中身）
 * 5. 今までのページ（Gallery・Series・About・Contact・英語・方針）も、同じ住所で開ける
 * 6. `?design=classic` で下見をやめられる
 *
 * 人工データの写真へ、この spec の中だけ分類を付けて見る（保存はしない）。
 */
type Photo = Record<string, unknown> & { id: number };

async function withCategories(page: Page, api: SmokeApi): Promise<Photo[]> {
  const data = (await (await api.get("/api/photos")).json()) as { photos: Photo[] };
  const photos = data.photos.map((p, i) => ({
    ...p,
    category: i < 5 ? "portrait" : i < 9 ? "life" : i < 11 ? "nature" : "",
  }));
  await page.route(
    (url) => url.pathname === "/api/photos",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...data, photos }),
      }),
  );
  return photos;
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const menuHrefs = (page: Page) =>
  page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll<HTMLAnchorElement>("header a[href], nav a[href]")].map((a) => a.getAttribute("href")!),
    ),
  ]);

test("新しい構成 › 何もしなければ今までの構成のまま", async ({ page, api }) => {
  await withCategories(page, api);
  await page.goto("/", { waitUntil: "networkidle" });
  const hrefs = await menuHrefs(page);
  expect(hrefs).toContain("/about");
  expect(hrefs).toContain("/contact");
  expect(hrefs).not.toContain("/portrait");
  expect(hrefs).not.toContain("/info");
  await expect(page.locator(".dv-home")).toHaveCount(0);
  for (const path of ["/portrait", "/life", "/info"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "ページが見つかりませんでした" })).toBeVisible();
  }
});

test("新しい構成 › 下見の住所で、メニュー・表紙・扉の目次が出る", async ({ page, api }, testInfo) => {
  await withCategories(page, api);
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-home")).toBeVisible();
  const hrefs = await menuHrefs(page);
  for (const href of ["/portrait", "/life", "/info"]) expect(hrefs).toContain(href);
  expect(hrefs).not.toContain("/about");
  expect(hrefs).not.toContain("/contact");
  // 下見の間は検索に載せない。
  await expect(page.locator('meta[name="robots"][data-design-preview]')).toHaveAttribute("content", "noindex");

  // 表紙は最初の画面に収まり、写真が出ている。
  const cover = page.locator(".dv-cover__photo[data-on] img");
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const frame = await page.locator(".dv-cover__frame").boundingBox();
  const viewport = page.viewportSize()!;
  expect(frame!.y + frame!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(frame!.height).toBeGreaterThan(300);

  // 扉は Portrait・Life・（Series）・Info の順。
  const doors = await page.locator(".dv-door").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(doors[0]).toBe("/portrait");
  expect(doors[1]).toBe("/life");
  expect(doors[doors.length - 1]).toBe("/info");
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("develop-home.png"), fullPage: true });
});

test("新しい構成 › Portrait と Life は分類から出て、押すとビューアが開く", async ({ page, api }, testInfo) => {
  const photos = await withCategories(page, api);
  // Gallery を「ランダム」にしているサイトでも、Portrait／Life の並びは開くたびに変わらない（管理画面で決めた順）。
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...settings, gallerySortOrder: "random" }),
    }),
  );
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  await page.locator('.dv-door[href="/portrait"]').click();
  await expect(page).toHaveURL(/\/portrait$/);
  await expect(page.getByRole("heading", { level: 1, name: "Portrait" })).toBeVisible();
  await expect(page.locator(".ps-tile")).toHaveCount(5);
  const shown = () =>
    page.locator(".ps-tile__button").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-tile"))));
  const firstOrder = await shown();
  const manual = photos
    .filter((p) => p.category === "portrait")
    .map((p, i) => ({ id: p.id, order: Number((p as { sortOrder?: number }).sortOrder ?? 0), i }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((p) => p.id);
  expect(firstOrder).toEqual(manual);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".ps-tile")).toHaveCount(5);
  expect(await shown()).toEqual(firstOrder);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("develop-portrait.png"), fullPage: true });

  await page.locator(".ps-tile__button").first().click();
  const viewer = page.locator("dialog[open]");
  await expect(viewer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);

  // 下見はページを移っても続く（住所に印が無くても）。
  await page.goto("/life", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Life" })).toBeVisible();
  await expect(page.locator(".ps-tile")).toHaveCount(6);
});

test("新しい構成 › 選んだ写真があれば、分類に関係なく、選んだ順で出る", async ({ page, api }) => {
  const photos = await withCategories(page, api);
  // 分類の無い写真（11枚目以降）を2枚と、分類 life の1枚を、この順で Portrait に選ぶ。
  const picked = [photos[12]!.id, photos[6]!.id, photos[11]!.id];
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...settings, developPortraitIds: picked.join(","), developLifeIds: "" }),
    }),
  );
  await page.goto("/portrait?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".ps-tile")).toHaveCount(3);
  const shown = await page
    .locator(".ps-tile__button")
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-tile"))));
  expect(shown).toEqual(picked);
  // 選んでいない Life は、今までどおり分類から出る。
  await page.goto("/life", { waitUntil: "networkidle" });
  await expect(page.locator(".ps-tile")).toHaveCount(6);
});

test("新しい構成 › Info は自己紹介と依頼。今までのページも同じ住所で開ける", async ({ page, api }, testInfo) => {
  await withCategories(page, api);
  await page.goto("/info?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-info .profile-page")).toBeVisible();
  // 依頼の部分は今までの Contact そのもの（フォームを出すかどうかは今までの設定に従う）。
  await expect(page.locator(".dv-info .contact-page")).toBeVisible();
  // 1ページとして読めること：h1 は1つだけ。すぐ下に依頼の欄があるので、自己紹介の末尾の案内は出さない。
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator(".dv-info .profile-page .inquiry-note")).toHaveCount(0);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("develop-info.png"), fullPage: true });

  for (const [path, ready] of [
    ["/gallery", "main .photo-card"],
    ["/series", "main h1"],
    ["/about", "main .profile-page"],
    ["/contact", "main .contact-page"],
    ["/en/contact", "main .contact-page"],
    ["/privacy", "main h1"],
  ] as const) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator(ready).first(), path).toBeVisible();
    expect(await menuHrefs(page), path).toContain("/portrait");
    await expect(page.getByRole("heading", { name: "ページが見つかりませんでした" }), path).toHaveCount(0);
  }
});

test("新しい構成 › ?design=classic で下見をやめられる", async ({ page, api }) => {
  await withCategories(page, api);
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-home")).toBeVisible();
  await page.goto("/?design=classic", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-home")).toHaveCount(0);
  expect(await menuHrefs(page)).toContain("/about");
  await page.goto("/portrait", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "ページが見つかりませんでした" })).toBeVisible();
});
