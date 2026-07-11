import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 2026-07-11 スマホ操作性改善の回帰テスト。
// 旧・上部2段横スクロールナビは active タブが画面外へ流れ、片手で届かなかった。
// 新UI: 下部3グループバー + ボトムシート。ここではタブ切替(localStorage のみ、
// 非書き込み)とタップ領域の高さだけを検証する — Save/Delete/Add は一切触らない。
test.describe("admin — スマホ下部ナビ", () => {
  test("下部バーからシート経由でタブ移動でき、タップ領域が確保されている", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "モバイル専用UIのため mobile プロジェクトのみで検証",
    );
    await loginAsAdmin(page);

    // 下部バー: 3グループが常時見える
    const nav = page.locator(".admin-bottom-nav");
    await expect(nav).toBeVisible();
    for (const label of ["写真", "見せ方", "サイト"]) {
      await expect(
        nav.getByRole("button", { name: new RegExp(label) }),
      ).toBeVisible();
    }

    // グループボタンは 44px 以上(タップ領域)
    const btnBox = await nav
      .getByRole("button", { name: /見せ方/ })
      .boundingBox();
    expect(btnBox!.height).toBeGreaterThanOrEqual(44);

    // 見せ方 → シートが開き、Series へ移動できる
    await nav.getByRole("button", { name: /見せ方/ }).click();
    const sheet = page.locator(".admin-sheet__panel");
    await expect(sheet).toBeVisible();
    const seriesRow = sheet.getByRole("button", { name: /Series/ });
    const rowBox = await seriesRow.boundingBox();
    expect(rowBox!.height).toBeGreaterThanOrEqual(44);
    await seriesRow.click();
    await expect(sheet).not.toBeVisible();
    await expect(
      page.locator(".admin-screen").getByRole("heading", { name: "Series" }),
    ).toBeVisible({ timeout: 10_000 });

    // サイトグループのシートには setup(はじめに)も並ぶ
    await nav.getByRole("button", { name: /サイト/ }).click();
    await expect(
      page
        .locator(".admin-sheet__panel")
        .getByRole("button", { name: /はじめに/ }),
    ).toBeVisible();
    // 背景タップで閉じる
    await page.locator(".admin-sheet__backdrop").click({ force: true });
    await expect(page.locator(".admin-sheet__panel")).not.toBeVisible();
  });

  test("デスクトップでは下部ナビが出ず、サイドバーが出る", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "デスクトップ表示の確認のため desktop プロジェクトのみで検証",
    );
    await loginAsAdmin(page);
    await expect(page.locator(".admin-bottom-nav")).toBeHidden();
    await expect(page.locator(".admin-sidebar")).toBeVisible();
  });
});
