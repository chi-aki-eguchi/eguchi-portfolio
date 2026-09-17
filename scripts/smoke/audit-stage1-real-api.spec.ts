// 第1段階（2026-09-17 の監査対応）を「実際の API ＋ 一時SQLite の人工データ」で確かめる。
// API のモックは置かない（通信失敗の再現だけ page.route を使う）。
// UI をモックで確かめる検査は admin-settings-preview.spec.ts と packages/web の描画テストにある。
import { SMOKE_SERIES, SMOKE_LONG_TITLE } from "../../packages/web/src/test-fixtures/smoke-site.ts";
import { expect, test } from "./fixtures.ts";
import { gotoAdminTab, loginAsAdmin } from "./helpers.ts";

const ENCODED_WORK_PATH = `/work/${encodeURIComponent(SMOKE_SERIES.encoded.slug)}`;
const ADMIN_ONLY = ["fileHash", "thumbKey", "mediumKey", "isPublished", "deletedAt", "shotAtSource"];
const SOURCE_RECORD = ["shotAtDigitized", "sourceWidth", "sourceHeight", "sourceFormat", "cameraMake", "cameraModel"];

test.describe("第1段階（実API＋人工データ）", () => {
  test("B-04: 作品詳細とトップ写真は公開用の形だけを返し、管理画面は管理用の項目を受け取る", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "API の確認は1回でよい");
    const detail = await (await page.request.get(`/api/series/${SMOKE_SERIES.harbour.slug}`)).json();
    const hero = await (await page.request.get("/api/hero-photos")).json();
    const list = await (await page.request.get("/api/photos")).json();
    expect(detail.photos.map((p: { id: number }) => p.id)).toEqual([7101, 7102, 7103, 7104, 7105, 7106]);
    const listKeys = Object.keys(list.photos[0]).sort();
    for (const row of [...detail.photos, ...hero.heroPhotos]) {
      expect(Object.keys(row).sort()).toEqual(listKeys);
      for (const key of [...ADMIN_ONLY, ...SOURCE_RECORD]) expect(row).not.toHaveProperty(key);
    }
    await loginAsAdmin(page);
    const all = await (await page.request.get("/api/photos?all=1")).json();
    const unpublished = all.photos.find((p: { id: number }) => p.id === 7107);
    expect(unpublished).toMatchObject({ isPublished: false, fileHash: "smoke-hash-7107", thumbKey: "thumbs/smoke-7107.webp" });
  });

  test("B-05: Work と Series の詳細は、404・通信失敗・写真0枚でも開いた棚へ戻す", async ({ page }) => {
    await page.goto("/work/no-such-work");
    await expect(page.getByText("作品が見つかりませんでした。")).toBeVisible();
    await expect(page.getByRole("link", { name: "← Work" })).toHaveAttribute("href", "/work");

    await page.goto("/series/no-such-series");
    await expect(page.getByText("シリーズが見つかりませんでした。")).toBeVisible();
    await expect(page.getByRole("link", { name: "← Series" })).toHaveAttribute("href", "/series");

    await page.goto(`/series/${SMOKE_SERIES.empty.slug}`);
    await expect(page.getByText("このシリーズにはまだ写真がありません")).toBeVisible();
    await expect(page.getByRole("link", { name: "← Series" })).toBeVisible();

    const detailApi = `**/api/series/${SMOKE_SERIES.commission.slug}`;
    await page.route(detailApi, (route) => route.abort("failed"));
    await page.goto(`/work/${SMOKE_SERIES.commission.slug}`);
    await expect(page.getByRole("alert")).toContainText("読み込めませんでした。");
    await expect(page.getByText("見つかりませんでした")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "← Work" })).toHaveAttribute("href", "/work");
    await page.unroute(detailApi);
    await page.getByRole("button", { name: "再読み込み" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SMOKE_SERIES.commission.title);
    await expect(page.locator('img[src*="smoke-760"], img[srcset*="smoke-760"]').first()).toBeVisible();
    await expect(page.getByRole("link", { name: "← Work" })).toHaveAttribute("href", "/work");
    // 次の作品は同じ Work の棚から選ばれ、辿ると符号化が要る slug の作品が開く。
    await page.getByRole("link", { name: new RegExp(SMOKE_SERIES.encoded.title) }).click();
    await expect(page).toHaveURL(new RegExp(`${ENCODED_WORK_PATH}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SMOKE_SERIES.encoded.title);
    await expect(page.getByRole("link", { name: "← Work" })).toHaveAttribute("href", "/work");
  });

  test("B-03: 設定プレビューで実際の作品一覧から Work・各作品を選び、公開リンクも同じ作品を指す", async ({ page }, info) => {
    await loginAsAdmin(page);
    await gotoAdminTab(page, "settings");
    const preview = page.locator("[data-settings-preview]");
    if (!(await preview.isVisible())) {
      const open = page.getByRole("button", { name: "プレビューを開く" });
      if (await open.count()) await open.click();
      const toPreview = page.getByRole("button", { name: "プレビュー", exact: true });
      if (!(await preview.isVisible()) && (await toPreview.count())) await toPreview.click();
    }
    await expect(preview).toBeVisible();
    const select = page.getByRole("combobox", { name: "確認するページ" });
    await expect(select.locator('option[value="/work"]')).toBeEnabled();
    for (const value of ["/series/harbour-light", "/series/long-title", "/series/empty-series", "/work/harbour-commission", ENCODED_WORK_PATH])
      await expect(select.locator(`option[value="${value}"]`)).toBeEnabled();
    await expect(select.locator('option[value="/series/long-title"]')).toHaveText(SMOKE_LONG_TITLE);
    for (const value of ["/series/draft-series", "/work/draft-work"])
      await expect(select.locator(`option[value="${value}"]`)).toBeDisabled();

    await select.selectOption(ENCODED_WORK_PATH);
    const iframe = page.locator('iframe[title="Site Preview"]');
    await expect
      .poll(() => iframe.evaluate((el: HTMLIFrameElement) => el.contentWindow!.location.pathname))
      .toBe(ENCODED_WORK_PATH);
    const frame = page.frameLocator('iframe[title="Site Preview"]');
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText(SMOKE_SERIES.encoded.title);
    await expect(page.locator(".studio-preview-status a")).toHaveAttribute("href", ENCODED_WORK_PATH);

    await select.selectOption("/series/empty-series");
    await expect(frame.getByText("このシリーズにはまだ写真がありません")).toBeVisible();
    await expect(page.locator(".studio-preview-status a")).toHaveAttribute("href", "/series/empty-series");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    if (info.project.name === "desktop") await expect(page.locator(".studio-preview-note")).toHaveCount(0);
  });
});
