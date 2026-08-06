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
    await page.getByPlaceholder(/移動先/).fill("ゴミ箱");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);

    // Trash画面の文言はDB状態で変わる（空=「ゴミ箱は空です」/ 非空=「削除済み
    // 写真 —」バナー）。本番DBに接続するsmokeでは空を前提にできない。
    const trashMarker = /ゴミ箱は空です|削除済み写真 —/;
    expect(await page.getByText(trashMarker).count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Hero" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Library" }).click();
    await page.waitForTimeout(1000);

    // 修正前はここで再び Trash が開いてしまっていた。ツールバー（絞り込み）は
    // Trash表示中も出るため、Trash画面のマーカー不在まで確認して判定する。
    expect(await page.getByText("絞り込み").count()).toBeGreaterThan(0);
    expect(await page.getByText(trashMarker).count()).toBe(0);
  });
});
