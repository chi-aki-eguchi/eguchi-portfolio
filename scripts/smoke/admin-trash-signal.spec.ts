import { test, expect } from "./fixtures.ts";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

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

    await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
    await page.waitForTimeout(500);
    // 写真の詳しい道具（ゴミ箱のある一覧）へ、⌘K から普通に戻る。
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
    await page.getByPlaceholder(/移動先/).fill("詳しい道具");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    // 修正前はここで再び Trash が開いてしまっていた。ツールバー（絞り込み）は
    // Trash表示中も出るため、Trash画面のマーカー不在まで確認して判定する。
    expect(await page.getByText("絞り込み").count()).toBeGreaterThan(0);
    expect(await page.getByText(trashMarker).count()).toBe(0);
  });
});

test("old trash remains restorable and permanent deletion requires confirmation", async ({ page }) => {
  let deletions = 0;
  await page.route("**/api/admin/photos/trash", route => route.fulfill({ json: {
    automaticDeletion: false,
    photos: [{ id: 99199, filename: "old.svg", title: "保管中の写真", url: "/trash-fixture.svg", width: 300, height: 200, deletedAt: "2020-01-01T00:00:00Z" }],
  } }));
  await page.route("**/trash-fixture.svg*", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><path fill="#888" d="M0 0h300v200H0z"/></svg>' }));
  await page.route("**/api/admin/photos/99199/purge", route => {
    deletions++;
    return route.fulfill({ json: { ok: true } });
  });
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  await page.locator("summary").filter({ hasText: "表示" }).click();
  await page.getByRole("button", { name: /^ゴミ箱/ }).last().click();
  await expect(page.getByText(/削除済み写真 — 自動では消えません/)).toBeVisible();
  await expect(page.getByText(/残り\d+日/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "復元", exact: true })).toBeAttached();
  expect(deletions).toBe(0);
  await page.getByRole("button", { name: "すべて完全削除", exact: true }).click();
  await expect(page.getByText("1枚をすべて完全削除しますか？この操作は取り消せません。")).toBeVisible();
  expect(deletions).toBe(0);
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  expect(deletions).toBe(0);
});
