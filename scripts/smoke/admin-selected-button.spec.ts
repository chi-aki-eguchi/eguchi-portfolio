import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 回帰テスト(工程2 fix #9): 通常ボタンのリセットルール((0,5,1))が
// 選択済み/プライマリボタンの強調ルール((0,3,1))より詳細度が高く、
// Series のレイアウト選択ボタン等が選択済みでも強調表示にならなかった
// (className 上は正しく選択状態だが、computed style が変わらない)不具合。
test.describe("admin — 選択済みボタンが実際にハイライト表示される", () => {
  test("Seriesのレイアウト選択ボタンは選択すると背景がinkトーンになる", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Series" }).click();
    await page.waitForTimeout(1000);

    const editBtn = page.getByRole("button", { name: "編集" }).first();
    await editBtn.click();
    await page.waitForTimeout(400);

    const layoutBtn = page.getByRole("button", { name: "モザイク" }).first();
    await layoutBtn.click();
    await page.waitForTimeout(300);

    const bg = await layoutBtn.evaluate((el) => getComputedStyle(el).color);
    // --admin-ink は rgb(46, 44, 39) 系统。選択後もリセット側の色のままなら未修正。
    expect(bg).not.toBe("rgb(46, 44, 39)");
  });
});
