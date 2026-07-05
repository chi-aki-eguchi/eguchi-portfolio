import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 回帰テスト(工程2 fix #5): 密なUI文字(サイドバーのタブ名等)が
// サイト設定の装飾的な明朝体(--font-ja)にそのまま連動していたバグ。
// オーナー報告「フォントがダサい」の原因。
test.describe("admin — 密なUI文字が固定のサンセリフで表示される", () => {
  test("サイドバーのタブ名は --font-ja(サイトの明朝体等)ではなく固定のUIフォントを使う", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.waitForTimeout(500);

    const tabFont = await page
      .locator(".admin-sidebar__tab span")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    const fontJa = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--font-ja"),
    );

    expect(tabFont).not.toContain(fontJa.trim().replace(/['"]/g, ""));
    expect(tabFont.toLowerCase()).toContain("sans");
  });

  test("サイドバーのサイト名(ブランド見出し)は引き続き --admin-font-title を使う", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.waitForTimeout(500);

    const titleFont = await page
      .locator(".admin-sidebar__title")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    const fontEn = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--font-en"),
    );

    const firstFontEn = fontEn.split(",")[0]?.trim().replace(/['"]/g, "");
    expect(titleFont).toContain(firstFontEn);
  });
});
