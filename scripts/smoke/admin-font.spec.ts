import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

function firstFamily(fontList: string): string {
  return fontList.split(",")[0]?.trim().replace(/['"]/g, "") ?? "";
}

test.describe("admin — フォントが公開サイト設定と揃う", () => {
  test("サイドバーのタブ名は公開サイトの日本語フォントを使う", async ({
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
    const siteJa = firstFamily(fontJa);

    expect(siteJa).not.toBe("");
    expect(tabFont).toContain(siteJa);
  });

  test("サイドバーのサイト名は公開サイトの英字フォントを使う", async ({
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
    const siteEn = firstFamily(fontEn);

    expect(siteEn).not.toBe("");
    expect(titleFont).toContain(siteEn);
  });
});
