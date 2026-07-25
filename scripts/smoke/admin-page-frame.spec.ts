import { test, expect } from "@playwright/test";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

test.describe("admin — 全タブの見出し位置が揃う", () => {
  test("9タブの見出し左端の差が2px以内", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "共通ページ枠は desktop の見出し位置で検証",
    );

    // 完了済みで折りたたまれた「はじめに」を含め、9タブをまとめて検証する。

    await loginAsAdmin(page);

    const titleXs: number[] = [];
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      const title = page.locator("h1.admin-page-header__title");
      await expect(title, `${tab} に共通見出しが必要`).toHaveCount(1);
      const box = await title.boundingBox();
      expect(box, `${tab} の見出し位置を取得できること`).not.toBeNull();
      titleXs.push(box!.x);
    }

    expect(Math.max(...titleXs) - Math.min(...titleXs)).toBeLessThanOrEqual(2);
  });
});
