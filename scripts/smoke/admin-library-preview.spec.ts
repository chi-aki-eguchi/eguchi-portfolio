import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoAdminTab } from "./helpers";

// Library のサイトプレビュー(2026-07-06 追加): 並べ替え・S/M/L の結果を
// Library に居たまま公開サイトの誌面(トップ/ギャラリー、PC/スマホ幅)で
// 確認できるパネル。全操作が GET のみ(DB書き込みなし)。
test.describe("admin — Library サイトプレビュー", () => {
  test("開く→ページ切替→スマホ幅→閉じるが一巡できる", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    const iframe = page.locator('iframe[title="サイトプレビュー"]');
    // 前セッションの persisted state が残っていても初期化できるよう、
    // 開いていたら一度閉じる。
    if (await iframe.count()) {
      await page.getByRole("button", { name: "プレビューを閉じる" }).click();
      await expect(iframe).toHaveCount(0);
    }

    await page.getByRole("button", { name: "サイトで確認" }).click();
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute("src", /\/(gallery)?$/);

    // ページ切替
    await page.getByRole("button", { name: "トップ" }).click();
    await expect(iframe).toHaveAttribute("src", "/");
    await page.getByRole("button", { name: "ギャラリー" }).click();
    await expect(iframe).toHaveAttribute("src", "/gallery");

    // スマホ幅切替(desktop プロジェクトのみ意味がある)
    const mobileBtn = page.getByRole("button", { name: "スマホ幅で確認" });
    if (await mobileBtn.isVisible()) {
      await mobileBtn.click();
      await page.waitForTimeout(400);
      await expect(iframe).toHaveCount(1);
    }

    await page.getByRole("button", { name: "プレビューを閉じる" }).click();
    await expect(iframe).toHaveCount(0);
  });
});
