import { test, expect } from "@playwright/test";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

test.describe("admin — 全画面の見出し位置", () => {
  test("9タブすべてが同じ左端に見出しを置く", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "共通ページ枠は desktop の見出し位置で検証",
    );

    // 2026-07-31 の刷新前は、Settings だけ左目次の右に見出しがあり、
    // 他タブから切り替えると見出しが 248px 横へ飛んでいた。
    // 目次は見出しの下へ移したので、9タブすべてが同じ左端に立つ。
    await loginAsAdmin(page);

    const titleXs: { tab: string; x: number }[] = [];
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      // 画面切替の横移動が完全に終わってから、静止位置だけを比べる。
      await page.waitForTimeout(300);
      const title = page.locator("h1.admin-page-header__title");
      await expect(title, `${tab} に共通見出しが必要`).toHaveCount(1);
      const box = await title.boundingBox();
      expect(box, `${tab} の見出し位置を取得できること`).not.toBeNull();
      titleXs.push({ tab, x: box!.x });
    }

    const xs = titleXs.map((entry) => entry.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    expect(
      spread,
      `見出しの左端がタブごとにずれている: ${JSON.stringify(titleXs)}`,
    ).toBeLessThanOrEqual(2);

    // 「全部そろって画面外」でも一致だけなら成功してしまう。
    // 左ナビ248pxの右側にあり、画面内に収まっていることも見る。
    const sidebar = await page.locator(".admin-sidebar").boundingBox();
    expect(sidebar).not.toBeNull();
    const leftEdge = Math.min(...xs);
    expect(leftEdge).toBeGreaterThan(sidebar!.x + sidebar!.width);
    expect(leftEdge).toBeLessThan(1440 * 0.5);
  });
});
