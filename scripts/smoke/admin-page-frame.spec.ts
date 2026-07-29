import { test, expect } from "@playwright/test";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

test.describe("admin — FormとWorkspaceの見出し位置", () => {
  test("Form画面を揃え、Libraryだけ写真領域を8px広げる", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "共通ページ枠は desktop の見出し位置で検証",
    );

    // 完了済みで折りたたまれた「はじめに」を含め、9タブをまとめて検証する。

    await loginAsAdmin(page);

    const formTitleXs: number[] = [];
    let libraryTitleX: number | null = null;
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      const title = page.locator("h1.admin-page-header__title");
      await expect(title, `${tab} に共通見出しが必要`).toHaveCount(1);
      const box = await title.boundingBox();
      expect(box, `${tab} の見出し位置を取得できること`).not.toBeNull();
      if (tab === "gallery") libraryTitleX = box!.x;
      else formTitleXs.push(box!.x);
    }

    expect(Math.max(...formTitleXs) - Math.min(...formTitleXs)).toBeLessThanOrEqual(
      2,
    );
    expect(libraryTitleX).not.toBeNull();
    const formTitleX = Math.min(...formTitleXs);
    expect(formTitleX - libraryTitleX!).toBeGreaterThanOrEqual(6);
    expect(formTitleX - libraryTitleX!).toBeLessThanOrEqual(10);
  });
});
