import { test, expect } from "@playwright/test";
import {
  ADMIN_TABS,
  loginAsAdmin,
  gotoAdminTab,
  findScrollableInContent,
  scrollContentToBottom,
} from "./helpers";

// 回帰テスト(工程2 fix #1): .admin-screen に height が無く、.admin-content の
// overflow:hidden がスクロール可能なコンテンツを問答無用にクリップしていたバグ。
// 各タブでオーバーフローがあれば、下端までスクロールできることを確認する。
test.describe("admin — 全タブでスクロールできる", () => {
  for (const tab of ADMIN_TABS) {
    test(`${tab}: オーバーフロー時に下端までスクロールできる`, async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await gotoAdminTab(page, tab);

      const before = await findScrollableInContent(page);
      test.skip(
        !before,
        "このタブ/画面幅では現在オーバーフローするコンテンツがない(データ依存)",
      );
      if (!before) return;

      const afterScrollTop = await scrollContentToBottom(page);
      await page.waitForTimeout(150);

      expect(afterScrollTop).not.toBeNull();
      expect(afterScrollTop as number).toBeGreaterThan(before.scrollTop);
    });
  }
});
