import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 回帰テスト(工程2 fix #2): 遷移アニメの exit タイマーが完了する前に元のタブへ
// 戻すと、screenPhase が "exit"(opacity:0)のまま固着してコンテンツ欄が
// 消えたまま二度と戻らないバグ。
test.describe("admin — 高速タブ切替でコンテンツが消えたままにならない", () => {
  test("遷移完了前に元のタブへ戻しても表示が回復する", async ({
    page,
  }, testInfo) => {
    // バグ自体(screenPhase の状態機械)はビューポート非依存だが、この検証は
    // サイドバーのタブボタンを直接クリックする都合上 desktop プロジェクトでのみ実行する
    // (mobile ではタブがグループ切替の奥に隠れており、同じ操作を再現しにくい)。
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);

    await page.getByRole("button", { name: "Profile" }).click();
    await page.waitForTimeout(400);

    // exit タイマー(160ms)が完了する前に Library → Profile と素早く往復させる。
    await page.getByRole("button", { name: "Library" }).click();
    await page.waitForTimeout(60);
    await page.getByRole("button", { name: "Profile" }).click();

    // 修正前はここで screenPhase が "exit" に固着し、二度と回復しなかった。
    await page.waitForTimeout(2000);

    const screen = page.locator(".admin-screen");
    await expect(screen).toHaveAttribute("data-phase", "show");
    await expect(screen).toHaveCSS("opacity", "1");
    expect((await screen.textContent())?.trim().length).toBeGreaterThan(0);
  });
});
