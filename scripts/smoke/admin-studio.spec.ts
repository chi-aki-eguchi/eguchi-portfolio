import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";
import { loginAsAdmin } from "./helpers";

/**
 * 写真中心の管理画面（siteDesign = "book"、2026-09-26 作り直し）。
 *
 * - 最初に開くのは「写真」。すべての写真が主役で、シリーズに入っていない写真を
 *   左の列から絞り込める
 * - 右の欄のチェックで、1枚をほかの所属はそのままに別のシリーズへも入れられる
 * - 写真を左のシリーズへドラッグすると、そのシリーズに入る
 * - ドラッグでサイトの並びを変えられる
 * - シリーズの画面の「写真を加える」で、写真の一覧から選んで入れられる
 *
 * 書き込みはこの spec の中で受け止め（送られた中身を確かめる）、DB には書かない。
 */

type Captured = { url: string; body: unknown };

async function openStudio(page: Page, api: SmokeApi) {
  const writes: Captured[] = [];
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.request().method() !== "GET"
      ? route.fallback()
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...settings, siteDesign: "book" }),
        }),
  );
  await page.route(/\/api\/admin\/(series\/\d+\/photos(\/reorder)?|photos\/reorder|photos\/batch)$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    writes.push({ url: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await loginAsAdmin(page);
  await page.goto("/admin");
  await expect(page.locator(".st-workspace")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".st-tile").first()).toBeVisible();
  return writes;
}

test.describe("写真中心の管理画面", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, "PC 幅の操作（ドラッグ）を確かめる");

  test("最初は「写真」。シリーズに入っていない写真を絞り込める", async ({ page, api }) => {
    await openStudio(page, api);
    await expect(page.getByRole("button", { name: "写真", exact: true })).toHaveAttribute("aria-current", "page");
    const loose = page.locator(".st-side__item", { hasText: "シリーズに入っていない" });
    const count = Number(await loose.locator(".st-side__count").textContent());
    await loose.click();
    await expect(page.locator(".st-toolbar__title h2")).toHaveText("シリーズに入っていない写真");
    await expect(page.locator(".st-tile")).toHaveCount(count);
    // 人工データ: 7001〜7009 のうちゴミ箱以外で、どのシリーズにも入っていない写真
    await expect(page.locator('.st-tile[data-photo-id="7101"]')).toHaveCount(0);
    await expect(page.locator('.st-tile[data-photo-id="7001"]')).toHaveCount(1);
  });

  test("右の欄のチェックで、ほかの所属はそのままに別のシリーズへも入れる", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    await page.locator('.st-tile[data-photo-id="7101"]').click();
    const checks = page.locator(".st-inspector .st-check", { hasText: "港の光" });
    await expect(checks.locator("input")).toBeChecked();
    await page.locator(".st-inspector .st-check", { hasText: "写真のない組" }).locator("input").click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({ url: "/api/admin/series/503/photos", body: { add: [7101] } });
    await expect(page.locator(".st-toast")).toContainText("に入れました");
  });

  test("写真を左のシリーズへドラッグすると、そのシリーズに入る", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    await page
      .locator('.st-tile[data-photo-id="7001"]')
      .dragTo(page.locator(".st-side__item", { hasText: "港の光" }));
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({ url: "/api/admin/series/501/photos", body: { add: [7001] } });
  });

  test("ドラッグでサイトの並びを変える", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    const tiles = page.locator(".st-tile");
    const ids = await tiles.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-id"))));
    await tiles.nth(0).dragTo(tiles.nth(3), { targetPosition: { x: 4, y: 20 } });
    await expect.poll(() => writes.length).toBe(1);
    const body = writes[0]!.body as { ids: number[]; expectedIds: number[] };
    expect(writes[0]!.url).toBe("/api/admin/photos/reorder");
    // 先頭の写真が、4枚目の前（3番目）へ
    expect(body.ids.slice(0, 4)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
    expect(body.expectedIds.slice(0, 4)).toEqual(ids.slice(0, 4));
  });

  test("シリーズの画面で、写真の一覧から選んで加える", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    await page.getByRole("button", { name: "シリーズ", exact: true }).click();
    await page.locator(".st-side__item--series", { hasText: "港の光" }).click();
    await expect(page.locator(".st-title-input")).toHaveValue("港の光");
    await page.getByRole("button", { name: "写真を加える" }).click();
    const dialog = page.locator("dialog.st-dialog[open]");
    await expect(dialog).toBeVisible();
    await dialog.locator('.st-tile[data-photo-id="7001"]').click();
    await dialog.locator('.st-tile[data-photo-id="7004"]').click();
    await dialog.getByRole("button", { name: "2枚を加える" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]!.url).toBe("/api/admin/series/501/photos");
    expect((writes[0]!.body as { add: number[] }).add.sort()).toEqual([7001, 7004]);
  });

  test("サイト › シリーズの中の並びに、この構成で使わない設定を書く", async ({ page, api }) => {
    await openStudio(page, api);
    await page.getByRole("navigation", { name: "管理画面の入口" }).getByRole("button", { name: "サイト" }).click();
    await page.getByRole("button", { name: /シリーズの中の並び/ }).click();
    const note = page.locator(".admin-book-unused");
    await expect(note).toBeVisible();
    await expect(note).toContainText("トップにはいつもすべての公開写真");
    await page.getByRole("button", { name: /背景と配色/ }).click();
    await expect(note).toHaveCount(0);
  });
});
