import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 回帰テスト(工程2 fix #4): [class*="text-red"] / [class*="bg-red"] が
// `hover:text-red-400` のようなバリアント接頭辞つきクラスにも部分一致し、
// 本来ホバー時だけ赤くなるはずのアイコンが常時赤表示になっていたバグ。
test.describe("admin — ホバー限定の赤クラスが常時赤くならない", () => {
  test("Serviceの実例セクション削除アイコンはホバーするまで赤くない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    const serviceTab = page.getByRole("button", { name: "Portfolio Kit" });
    test.skip(
      (await serviceTab.count()) === 0,
      "Serviceページが設定で非表示のため、この見た目検査は対象外",
    );
    await serviceTab.click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "実例セクション" }).click();
    await page.waitForTimeout(400);

    const del = page.locator('button[title="削除"]').first();
    await expect(del).toBeVisible();

    const restColor = await del.evaluate((el) => getComputedStyle(el).color);
    // admin-danger は rgb(163, 59, 46) 系统 — ホバーしていない状態でこれになっていたら未修正。
    expect(restColor).not.toBe("rgb(163, 59, 46)");
  });

  test("Library写真選択時のリングはニュートラルなグレーで、アクセント色(赤)に上書きされない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Library" }).click();
    await page.waitForTimeout(1500);

    const tile = page.locator(".admin-photo-tile").first();
    await tile.click();
    await page.waitForTimeout(300);

    const boxShadow = await tile.evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    // #aaaaaa = rgb(170, 170, 170)。admin-accent(163, 59, 46)に上書きされていたら未修正。
    expect(boxShadow).toContain("rgb(170, 170, 170)");
    expect(boxShadow).not.toContain("rgb(163, 59, 46)");
  });
});
