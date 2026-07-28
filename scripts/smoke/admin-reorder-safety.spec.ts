import { test, expect, type Page, type Route } from "@playwright/test";

// 並べ替えの土台の安全性を実ブラウザで確かめる。
//
// 中心の危険: `GET /photos` はサイト設定の並び順に従って返すため、Library が
// 「手動」と表示していても実際は撮影日順を見ていることがある。その配列を
// そのまま sort_order として保存すると、保存済みの手動順が置き換わる。
//
// ここでは **API が sortOrder とは違う順で返す** 状況を作り、
// 画面と保存内容の両方が sortOrder 側に従うことを確認する。
//
// ログインせず `/api/**` を人工データで塞ぐため、本番DBへは触らない。
// 非GETは記録し、reorder 以外がネットワークへ出たらテストを失敗させる。

type Captured = { ids: number[]; expectedIds: number[] } | null;

// sortOrder は 0..9。ただし API はわざと逆順（撮影日順のつもり）で返す。
const PHOTOS = Array.from({ length: 10 }, (_, index) => ({
  id: 6_100_000 + index,
  filename: `order-${index}.png`,
  url: `/api/images/order/${index}.png`,
  thumbUrl: `/api/images/order/t${index}.png`,
  mediumUrl: `/api/images/order/m${index}.png`,
  title: `順序確認 ${index}`,
  meta: "",
  description: "",
  category: null,
  camera: null,
  lens: null,
  focalLength: null,
  fNumber: null,
  exposureTime: null,
  iso: null,
  filmType: "デジタル",
  shotAt: null,
  displaySize: "M",
  width: 1200,
  height: 800,
  rotationDeg: 0,
  focalX: 50,
  focalY: 50,
  sortOrder: index,
  seriesId: null,
  isPublished: true,
  fileHash: null,
  deletedAt: null,
  createdAt: null,
}));

const RECEIVED_ORDER = [...PHOTOS].reverse(); // API が返す順（sortOrder と逆）

async function installMocks(page: Page) {
  const state: { captured: Captured; otherWrites: string[] } = {
    captured: null,
    otherWrites: [],
  };
  const json = (value: unknown) => (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      state.otherWrites.push(`${request.method()} ${request.url()}`);
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/images/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from([]) }),
  );
  await page.route("**/api/admin/photos/reorder**", async (route) => {
    const body = route.request().postDataJSON() as {
      ids: number[];
      expectedIds: number[];
    };
    state.captured = { ids: body.ids, expectedIds: body.expectedIds };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route("**/api/admin/photos/trash**", json({ photos: [] }));
  await page.route("**/api/settings**", json({ siteName: "順序検査" }));
  await page.route("**/api/photos**", json({ photos: RECEIVED_ORDER }));
  await page.route("**/api/categories**", json({ categories: [] }));
  await page.route("**/api/series**", json({ series: [] }));
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  return state;
}

async function openLibrary(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("admin:tab", JSON.stringify("gallery"));
    sessionStorage.clear();
  });
  await page.goto("/admin");
  await page.waitForSelector(".admin-atelier", { timeout: 20_000 });
  const sidebar = page
    .locator("button:visible, a:visible")
    .filter({ hasText: /^\s*Library\s*$/ });
  if ((await sidebar.count()) > 0) await sidebar.first().click();
  await page
    .locator("button:visible")
    .filter({ hasText: /^\s*Table\s*$/ })
    .first()
    .waitFor({ timeout: 15_000 });
}

test.describe("admin — 並べ替えの土台の安全性", () => {
  test("APIが別の順で返しても、画面と保存はsortOrder順に従う", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで確認する");

    const state = await installMocks(page);
    await openLibrary(page);

    // 画面の並びが sortOrder 順（受け取り順の逆）になっていること
    const shownTitles = await page
      .locator("[data-library-photo-title], img[alt^='順序確認']")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute("alt") ?? node.textContent ?? "")
          .filter((text) => text.startsWith("順序確認")),
      );
    expect(
      shownTitles.length,
      "写真が描画されている",
    ).toBeGreaterThan(0);
    expect(
      shownTitles[0],
      `先頭が sortOrder 0 の写真（実際: ${shownTitles[0]}）。受け取り順に従っていると「順序確認 9」になる`,
    ).toBe("順序確認 0");

    // 「並べる」へ入り、先頭の写真を1つ後ろへ動かす
    await page
      .locator("button:visible")
      .filter({ hasText: /^\s*並べる\s*$/ })
      .first()
      .click();

    // 「後へ移動」= 1つ後ろへ。ボタンはhoverで現れるので、まず写真へ寄せる。
    const firstTile = page.locator(".admin-photo-tile").first();
    await firstTile.hover();
    const moveNext = page
      .locator('button[aria-label="後へ移動"]')
      .first();
    await moveNext.waitFor({ timeout: 10_000 });
    await moveNext.click();

    await expect
      .poll(() => state.captured !== null, { timeout: 10_000 })
      .toBe(true);

    const captured = state.captured!;
    const sortOrderIds = PHOTOS.map((photo) => photo.id);
    expect(
      captured.expectedIds,
      "expectedIds は sortOrder 順（受け取り順ではない）",
    ).toEqual(sortOrderIds);
    expect(
      captured.ids.slice().sort((a, b) => a - b),
      "保存する集合は全写真と一致する",
    ).toEqual(sortOrderIds.slice().sort((a, b) => a - b));
    expect(
      captured.ids,
      "受け取り順（逆順）をそのまま保存していない",
    ).not.toEqual(RECEIVED_ORDER.map((photo) => photo.id));

    expect(
      state.otherWrites,
      "reorder 以外の書き込み要求が出ていない",
    ).toEqual([]);
  });
});
