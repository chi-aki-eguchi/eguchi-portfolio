import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 回帰テスト(工程2 fix #7): ⌘KパレットからTrashを開くと openTrashRequest
// カウンタが無条件に加算され、以後 Library タブを普通に開くたびに
// Trash が再度開いてしまっていたバグ。desktopのみ(⌘K/サイドバー操作)。
test.describe("admin — ⌘KのTrashが後続のLibrary表示に持ち越されない", () => {
  test("⌘K→Trash後、他タブ経由でLibraryへ戻ると通常表示になる", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "⌘K/サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.waitForTimeout(800);

    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
    await page.getByPlaceholder(/移動先/).fill("Trash");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);

    expect(await page.getByText("ゴミ箱").count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Hero" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Library" }).click();
    await page.waitForTimeout(1000);

    // 修正前はここで再び Trash が開いてしまい、通常のツールバーが出なかった。
    expect(await page.getByText("絞り込み").count()).toBeGreaterThan(0);
  });
});
