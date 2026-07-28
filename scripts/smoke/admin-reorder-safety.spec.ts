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

type Captured = { ids: number[]; expectedIds: number[] };

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
  createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
}));

const RECEIVED_ORDER = [...PHOTOS].reverse(); // API が返す順（sortOrder と逆）

async function installMocks(
  page: Page,
  options: {
    gallerySortOrder?: string;
    settingsStatus?: number;
    settingsDelayMs?: number;
  } = {},
) {
  const state: {
    captured: Captured | null;
    captures: Captured[];
    otherWrites: string[];
    currentIds: number[];
    nextStatus: number;
    nextDelayMs: number;
  } = {
    captured: null,
    captures: [],
    otherWrites: [],
    currentIds: PHOTOS.map((photo) => photo.id),
    nextStatus: 200,
    nextDelayMs: 0,
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
    state.captures.push(state.captured);
    const delayMs = state.nextDelayMs;
    const status = state.nextStatus;
    state.nextDelayMs = 0;
    state.nextStatus = 200;
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (status === 200) state.currentIds = [...body.ids];
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? { ok: true }
          : {
              error:
                status === 409
                  ? "他の画面で変更されました。再読み込みしてください"
                  : "保存に失敗しました",
            },
      ),
    });
  });
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route("**/api/admin/photos/trash**", json({ photos: [] }));
  await page.route("**/api/settings**", async (route) => {
    if (options.settingsDelayMs)
      await new Promise((resolve) =>
        setTimeout(resolve, options.settingsDelayMs),
      );
    await route.fulfill({
      status: options.settingsStatus ?? 200,
      contentType: "application/json",
      body: JSON.stringify({
        siteName: "順序検査",
        gallerySortOrder: options.gallerySortOrder ?? "manual",
      }),
    });
  });
  await page.route("**/api/photos**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photos: RECEIVED_ORDER.map((photo) => ({
          ...photo,
          sortOrder: state.currentIds.indexOf(photo.id),
        })),
      }),
    }),
  );
  await page.route("**/api/categories**", json({ categories: [] }));
  await page.route("**/api/series**", json({ series: [] }));
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  return state;
}

async function enterArrange(page: Page) {
  await page
    .locator('button[data-library-mode-action="arrange"]:visible')
    .first()
    .click();
  await expect(
    page.locator("[data-library-arrange-toolbar]"),
  ).toBeVisible();
}

async function visiblePhotoTitles(page: Page) {
  return page
    .locator(".admin-photo-tile img[alt^='順序確認']")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("alt") ?? ""),
    );
}

async function openLibrary(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("admin:tab", JSON.stringify("gallery"));
    sessionStorage.clear();
  });
  await page.goto("/admin");
  await page.waitForSelector(".admin-atelier", { timeout: 20_000 });
  // 幅が狭いと左メニューが隠れ、下部ナビになる。見えている方から Library へ入る。
  // ここを間違えると「はじめに」タブのまま検査してしまい、並べ替え欄を一度も見ずに
  // 「見つからない」と落ちる（実際に一度そうなった）。
  const sidebar = page
    .locator("button:visible, a:visible")
    .filter({ hasText: /^\s*Library\s*$/ });
  if ((await sidebar.count()) > 0) {
    await sidebar.first().click();
  } else {
    await page
      .locator(".admin-bottom-nav__btn")
      .filter({ hasText: /写真/ })
      .first()
      .click();
    const sheetRow = page
      .locator(".admin-sheet__row")
      .filter({ hasText: "Library" });
    if ((await sheetRow.count()) > 0) await sheetRow.first().click();
  }
  // Library に着いたことを、写真ツールバーの存在で確かめてから先へ進む
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

  test("公開順が手動以外、取得中、取得失敗の間は並べ替えを開始できない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで状態を確認する");

    await installMocks(page, { gallerySortOrder: "shot_desc" });
    await openLibrary(page);
    const arrange = page
      .locator('button[data-library-mode-action="arrange"]')
      .first();
    await expect(arrange).toBeDisabled();
    await expect(
      page.getByText(
        "現在の公開並びは手動順ではないため、ここでは並べ替えできません",
      ),
    ).toBeVisible();

    await page.unrouteAll({ behavior: "wait" });
    await installMocks(page, { settingsDelayMs: 5_000 });
    await openLibrary(page);
    await expect(
      page.locator('[data-library-public-order-lock="loading"]'),
    ).toBeVisible();
    await expect(
      page.locator('button[data-library-mode-action="arrange"]').first(),
    ).toBeDisabled();
  });

  test("保存中は連打を拒否し、再取得後だけ保存済みとUndoを出す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで状態を確認する");

    const state = await installMocks(page);
    await openLibrary(page);
    await enterArrange(page);
    state.nextDelayMs = 500;

    const firstTile = page.locator(".admin-photo-tile").first();
    await firstTile.hover();
    await firstTile.getByRole("button", { name: "後へ移動" }).click();

    await expect(
      page.locator('[data-library-reorder-status="saving"]'),
    ).toContainText("保存中");
    await expect(
      page.getByRole("button", { name: "後へ移動" }).first(),
    ).toBeDisabled();
    await page.waitForTimeout(100);
    expect(state.captures).toHaveLength(1);
    expect((await visiblePhotoTitles(page)).slice(0, 2)).toEqual([
      "順序確認 1",
      "順序確認 0",
    ]);

    await expect(
      page.locator('[data-library-reorder-status="saved"]'),
    ).toContainText("保存済み");
    await expect(page.locator("[data-library-reorder-undo]")).toBeVisible();
    expect(state.otherWrites).toEqual([]);
  });

  test("保存失敗は操作前へ戻し、Undo失敗はUndo前の保存済み順へ戻す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで状態を確認する");

    const state = await installMocks(page);
    await openLibrary(page);
    await enterArrange(page);
    state.nextStatus = 500;
    state.nextDelayMs = 100;
    await page.locator(".admin-photo-tile").first().hover();
    await page.getByRole("button", { name: "後へ移動" }).first().click();
    await expect(
      page.locator('[data-library-reorder-status="error"]'),
    ).toBeVisible();
    expect((await visiblePhotoTitles(page)).slice(0, 2)).toEqual([
      "順序確認 0",
      "順序確認 1",
    ]);
    await expect(page.locator("[data-library-reorder-undo]")).toHaveCount(0);

    await page.getByRole("button", { name: "後へ移動" }).first().click();
    await expect(
      page.locator('[data-library-reorder-status="saved"]'),
    ).toBeVisible();
    expect((await visiblePhotoTitles(page)).slice(0, 2)).toEqual([
      "順序確認 1",
      "順序確認 0",
    ]);

    state.nextStatus = 500;
    await page.locator("[data-library-reorder-undo]").click();
    await expect(
      page.locator('[data-library-reorder-status="error"]'),
    ).toContainText("Undo前の保存済み順");
    expect((await visiblePhotoTitles(page)).slice(0, 2)).toEqual([
      "順序確認 1",
      "順序確認 0",
    ]);
    expect(state.otherWrites).toEqual([]);
  });

  test("別タブ競合後のUndoは拒否し、最新順を取り直す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで状態を確認する");

    const state = await installMocks(page);
    await openLibrary(page);
    await enterArrange(page);
    await page.locator(".admin-photo-tile").first().hover();
    await page.getByRole("button", { name: "後へ移動" }).first().click();
    await expect(page.locator("[data-library-reorder-undo]")).toBeVisible();

    state.currentIds = [...state.currentIds].reverse();
    state.nextStatus = 409;
    await page.locator("[data-library-reorder-undo]").click();
    await expect(
      page.locator('[data-library-reorder-status="error"]'),
    ).toContainText("別の画面で順序が変わった");
    await expect(page.locator("[data-library-reorder-undo]")).toHaveCount(0);
    expect((await visiblePhotoTitles(page))[0]).toBe("順序確認 9");
    expect(state.otherWrites).toEqual([]);
  });

  test("Tableで保存した順序をGridとTableが同じ順で表示する", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで状態を確認する");

    const state = await installMocks(page);
    await openLibrary(page);
    await page.locator("[data-library-sort]").selectOption("createdAt-desc");
    await page.getByRole("button", { name: "この並びを保存" }).click();
    await page
      .locator("dialog")
      .getByRole("button", { name: "この並びを保存" })
      .click();
    await expect(
      page.locator('[data-library-reorder-status="saved"]'),
    ).toBeVisible();
    expect((await visiblePhotoTitles(page))[0]).toBe("順序確認 9");

    await page.getByRole("button", { name: "Table" }).click();
    await expect(
      page.locator("tbody tr[data-bulk-edit-photo-id]").first(),
    ).toHaveAttribute(
      "data-bulk-edit-photo-id",
      String(PHOTOS[PHOTOS.length - 1].id),
    );
    expect(state.otherWrites).toEqual([]);
  });

  test("390pxでは2列・先頭/末尾・位置指定が欠けず、10番目へ移動できる", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-touch",
      "390pxのタッチ端末で確認する",
    );

    const state = await installMocks(page);
    await openLibrary(page);
    await enterArrange(page);
    const firstTile = page.locator(".admin-photo-tile").first();
    const secondTile = page.locator(".admin-photo-tile").nth(1);
    const thirdTile = page.locator(".admin-photo-tile").nth(2);
    const [firstBox, secondBox, thirdBox] = await Promise.all([
      firstTile.boundingBox(),
      secondTile.boundingBox(),
      thirdTile.boundingBox(),
    ]);
    expect(firstBox).not.toBeNull();
    expect(secondBox?.y).toBe(firstBox?.y);
    expect(thirdBox?.y).toBeGreaterThan(firstBox?.y ?? 0);

    for (const name of ["先頭へ移動", "末尾へ移動", "何番目へ移動"]) {
      const control = firstTile.getByRole("button", { name });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect((box?.x ?? 400) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }

    await firstTile.getByRole("button", { name: "何番目へ移動" }).click();
    await page.locator("[data-library-position-input]").fill("10");
    await page.getByRole("button", { name: "移動する" }).click();
    await expect(
      page.locator('[data-library-reorder-status="saved"]'),
    ).toBeVisible();
    expect(state.captured?.ids[9]).toBe(PHOTOS[0].id);
    expect(state.otherWrites).toEqual([]);
  });
});
