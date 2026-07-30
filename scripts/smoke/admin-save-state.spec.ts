import { test, expect, type Page, type Route } from "@playwright/test";

// 管理画面の保存状態まわりを、**本番DBへ一切触らずに**検査する。
//
// helpers.ts の警告どおり、この開発環境は本番と同じDBにつながっている。
// そこでこのスペックはログインせず、`/api/**` をすべて人工データで塞ぐ。
// 認証確認(`/api/admin/me`)も差し替えるため、ネットワークへ出る本物の要求は無い。
// `/admin/demo` は所有者ドメインでしか有効にならないため、ここでは使えない。
//
// 非GETが1件でもネットワークへ出たらテストを失敗させる。書き込み事故の番人。

const SETTINGS = {
  siteName: "検査用サイト",
  siteNameEn: "Fixture Site",
  heroSubtitle: "検査用",
  profileName: "検査用",
  contactEmail: "fixture@example.test",
  servicePageMode: "off",
};

const CATEGORIES = [
  { id: 8_300_001, slug: "fixture-people", label: "人物（検査用）", sortOrder: 0 },
  { id: 8_300_002, slug: "fixture-places", label: "風景（検査用）", sortOrder: 1 },
];

type Mocks = { nonGet: string[]; unknown: string[] };

async function installAdminApiMocks(page: Page): Promise<Mocks> {
  const nonGet: string[] = [];
  const unknown: string[] = [];

  const json = (value: unknown) => (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

  // 受け皿。未知のGETは空で返し、非GETは記録して止める（本番へ出さない）。
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      nonGet.push(`${request.method()} ${request.url()}`);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "write blocked in smoke" }),
      });
      return;
    }
    unknown.push(request.url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.route("**/api/images/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from([]) }),
  );
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route("**/api/admin/photos/trash**", json({ photos: [] }));
  await page.route("**/api/settings**", json(SETTINGS));
  await page.route("**/api/photos**", json({ photos: [] }));
  await page.route("**/api/categories**", json({ categories: CATEGORIES }));
  await page.route("**/api/series**", json({ series: [] }));
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  await page.route("**/api/note-posts**", json({ posts: [] }));

  return { nonGet, unknown };
}

// 初期表示は「はじめに」になることがあるため、左メニューを実際に押して移動する。
async function openAdminTab(page: Page, label: string) {
  await page.addInitScript(() => {
    // 前回の下書きが残っていると未保存判定の検査にならない
    sessionStorage.clear();
  });
  await page.goto("/admin");
  await page.waitForSelector(".admin-atelier", { timeout: 15_000 });
  await page
    .locator("button, a")
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .first()
    .click();
}

test.describe("admin — 保存状態の表示", () => {
  test("Service は設定を読めない間、既定値の編集・保存を出さず、再試行で戻る", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCのService画面で検証する");

    const mocks = await installAdminApiMocks(page);
    let settingsAvailable = false;
    // installAdminApiMocks の通常の settings 応答より後に登録し、この検査だけ
    // GET /api/settings を失敗させる。他の API はすべて人工データのままにする。
    await page.route("**/api/settings**", async (route) => {
      if (!settingsAvailable) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "settings unavailable in smoke" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SETTINGS),
      });
    });

    // 左メニューでの表示名は「Portfolio Kit」
    await openAdminTab(page, "Portfolio Kit");

    await expect(
      page.getByRole("heading", { name: "読み込めませんでした" }),
      "設定を読めない時は、既定値のService編集画面ではなく失敗画面を出す",
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("input, textarea"),
      "失敗中は編集欄を出さない",
    ).toHaveCount(0);
    await expect(
      page.locator(".admin-floating-save-bar"),
      "失敗中は保存操作を出さない",
    ).toHaveCount(0);

    settingsAvailable = true;
    await page.getByRole("button", { name: "再試行" }).click();
    await expect(
      page.locator("input, textarea").first(),
      "再試行に成功したら通常のService編集画面に戻る",
    ).toBeVisible();

    expect(mocks.nonGet, "本番へ書き込む要求が出ていない").toEqual([]);
  });

  test("値を元に戻したら未保存表示が消える", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCの保存バーで検証する");

    const mocks = await installAdminApiMocks(page);
    await openAdminTab(page, "Settings");

    // 設定の本文は目次で選んだ1節だけを出す。既定は先頭の節。
    const firstSection = page.locator("[data-settings-section]").first();
    await expect(firstSection, "設定の先頭節が本文に出ている").toBeVisible();

    const input = page.locator("input[type='text']").first();
    await expect(input, "設定の入力欄が見つかる").toBeVisible();

    const saveBar = page.locator(".admin-floating-save-bar");
    await expect(saveBar, "最初は未保存バーが出ていない").toHaveCount(0);

    const original = await input.inputValue();
    await input.fill(`${original}編集`);
    await expect(saveBar, "編集したら未保存バーが出る").toHaveCount(1);

    await input.fill(original);
    await expect(
      saveBar,
      "元の値へ戻したら未保存バーが消える（キーの有無ではなく値で判定する）",
    ).toHaveCount(0);

    expect(mocks.nonGet, "本番へ書き込む要求が出ていない").toEqual([]);
  });

  test("キーボードでフォーカスした削除ボタンが見える", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "hoverで隠れるのはデスクトップ幅だけ",
    );

    const mocks = await installAdminApiMocks(page);
    await openAdminTab(page, "Categories");

    const target = page
      .locator('button[aria-label*="削除"], button[aria-label*="Delete"]')
      .first();
    await expect(target, "カテゴリーの削除ボタンがある").toBeAttached();

    const hidden = await target.evaluate((el) => getComputedStyle(el).opacity);
    expect(
      Number(hidden),
      "hoverしていない間は隠れている（この前提が崩れたら検査の意味がない）",
    ).toBeLessThan(0.5);

    await target.focus();
    // 不透明度は160msかけて変わる（styles.css の transition）。
    // 直後に測ると0のままで、直っているのに壊れて見える。落ち着くまで待って測る。
    await expect
      .poll(
        async () => Number(await target.evaluate((el) => getComputedStyle(el).opacity)),
        {
          message: "キーボードでフォーカスしたら見える",
          timeout: 2000,
        },
      )
      .toBeGreaterThan(0.9);

    expect(mocks.nonGet, "本番へ書き込む要求が出ていない").toEqual([]);
  });
});
