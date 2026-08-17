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

  // 中間幅。1440px と 390px の両方を見張っていたのに、その間が抜けていた。
  // 実測(2026-08-17 / 1024px): 8タブが 97px、**Settings だけ 88px**。
  // 1024〜1199px 用の規則が左右 24px のべた書きで、他タブの --ax-inset
  // (この幅で 32.8px) と食い違っていた。**同じ不具合が、幅を変えるたびに
  // 別の場所で再発している**（390px は 2026-08-11 に同じ形で直した）。
  test("中間幅でも9タブすべてが同じ左端に見出しを置く", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "中間幅は desktop の viewport を変えて検証",
    );

    await page.setViewportSize({ width: 1024, height: 800 });
    await loginAsAdmin(page);

    const titleXs: { tab: string; x: number }[] = [];
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      await page.waitForTimeout(300);
      const title = page.locator("h1.admin-page-header__title");
      await expect(title, `${tab} に共通見出しが必要`).toHaveCount(1);
      const box = await title.boundingBox();
      expect(box, `${tab} の見出し位置を取得できること`).not.toBeNull();
      titleXs.push({ tab, x: box!.x });
    }

    const xs = titleXs.map((entry) => entry.x);
    expect(
      Math.max(...xs) - Math.min(...xs),
      `1024px で見出しの左端がタブごとにずれている: ${JSON.stringify(titleXs)}`,
    ).toBeLessThanOrEqual(2);
    expect(Math.min(...xs)).toBeGreaterThan(8);
  });

  // desktop だけ見ていたので、スマホ幅のずれを長らく見落としていた。
  // 実測(2026-08-11 / 390px): 8タブが 20px、**Settings だけ 12px**。
  // Settings の枠が --ax-inset ではなく 12px のべた書きだったため、スマホで
  // Settings へ切り替えると見出しが 8px 左へ飛んでいた。到達点(1)
  // 「タブを切り替えても内容が横に飛ばない」は机の上の幅だけの話ではない。
  test("スマホ幅でも9タブすべてが同じ左端に見出しを置く", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "スマホ幅の見出し位置は mobile で検証",
    );

    await loginAsAdmin(page);

    const titleXs: { tab: string; x: number }[] = [];
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      await page.waitForTimeout(300);
      const title = page.locator("h1.admin-page-header__title");
      await expect(title, `${tab} に共通見出しが必要`).toHaveCount(1);
      const box = await title.boundingBox();
      expect(box, `${tab} の見出し位置を取得できること`).not.toBeNull();
      titleXs.push({ tab, x: box!.x });
    }

    const xs = titleXs.map((entry) => entry.x);
    expect(
      Math.max(...xs) - Math.min(...xs),
      `スマホで見出しの左端がタブごとにずれている: ${JSON.stringify(titleXs)}`,
    ).toBeLessThanOrEqual(2);
    // 全部そろって画面外・端に貼り付いていないことも見る。
    expect(Math.min(...xs)).toBeGreaterThan(8);
  });
});
