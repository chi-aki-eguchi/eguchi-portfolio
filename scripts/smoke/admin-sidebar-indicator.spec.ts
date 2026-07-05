import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 回帰テスト(工程2 fix #8): モバイル→デスクトップの画面幅復帰で、サイドバーの
// アクティブタブ位置インジケータ(縦帯)が先頭に固着し、実際のタブに
// 追従しないバグ。desktopプロジェクトで、リサイズそのものを検証する。
test.describe("admin — サイドバーのインジケータがリサイズ後も正しい位置に追従する", () => {
  test("モバイル幅でタブ移動→デスクトップ幅へ復帰で位置が一致する", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "viewportを自分で切り替えるため desktop プロジェクトのみで実行",
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsAdmin(page);
    await page.waitForTimeout(500);

    await page
      .locator("header")
      .getByRole("button", { name: "サイト" })
      .click();
    await page.waitForTimeout(200);
    await page
      .locator("header")
      .getByRole("button", { name: "Settings" })
      .click();
    await page.waitForTimeout(300);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);

    const indicatorTransform = await page
      .locator(".admin-sidebar__indicator")
      .evaluate((el) => getComputedStyle(el).transform);
    const settingsTop = await page
      .locator(".admin-sidebar__tab", { hasText: "Settings" })
      .evaluate((el) => (el as HTMLElement).offsetTop);

    expect(indicatorTransform).toContain(`, ${settingsTop})`);
  });
});
