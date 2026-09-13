import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 回帰テスト(工程2 fix #8): モバイル→デスクトップの画面幅復帰で、サイドバーの
// アクティブタブ位置インジケータ(縦帯)が先頭に固着し、実際のタブに
// 追従しないバグ。desktopプロジェクトで、リサイズそのものを検証する。
test.describe("admin — 画面幅が変わっても作業場所と設定の現在地を保つ", () => {
  test("モバイルからサイト編集を開き、PC幅へ戻っても現在地が一致する", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "viewportを自分で切り替えるため desktop プロジェクトのみで実行",
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsAdmin(page);
    await page.waitForTimeout(500);

    // 設定はスマホの下部ナビから直接開く。
    // リサイズ後のインジケータ追従という検証対象は同じ。
    await page.locator("[data-admin-mobile-settings]").click();
    await page.waitForTimeout(300);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);

    const activeTab = page.locator('.admin-sidebar__tab[aria-current="page"]');
    await expect(activeTab).toHaveText("サイトデザイン");
    await expect(activeTab).toBeVisible();
    await expect(page.locator('.studio-workspace-switch button[aria-pressed="true"]')).toHaveText("サイト編集");
    await expect(page.locator('[data-settings-section-link][aria-current="location"]')).toHaveText("トップの見せ方");

  });
});
