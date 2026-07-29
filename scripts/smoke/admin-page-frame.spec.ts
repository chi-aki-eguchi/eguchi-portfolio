import { test, expect } from "@playwright/test";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

test.describe("admin — FormとWorkspaceの見出し位置", () => {
  test("通常画面を揃え、Library全幅とSettings目次を別配置にする", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "共通ページ枠は desktop の見出し位置で検証",
    );

    // 完了済みで折りたたまれた「はじめに」を含め、9タブをまとめて検証する。

    await loginAsAdmin(page);

    const standardTitleXs: number[] = [];
    let libraryTitleX: number | null = null;
    let settingsTitleX: number | null = null;
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      // 画面切替の横移動が完全に終わってから、静止位置だけを比べる。
      await page.waitForTimeout(300);
      const title = page.locator("h1.admin-page-header__title");
      await expect(title, `${tab} に共通見出しが必要`).toHaveCount(1);
      const box = await title.boundingBox();
      expect(box, `${tab} の見出し位置を取得できること`).not.toBeNull();
      if (tab === "gallery") libraryTitleX = box!.x;
      else if (tab === "settings") settingsTitleX = box!.x;
      else standardTitleXs.push(box!.x);
    }

    expect(
      Math.max(...standardTitleXs) - Math.min(...standardTitleXs),
    ).toBeLessThanOrEqual(2);
    expect(libraryTitleX).not.toBeNull();
    expect(settingsTitleX).not.toBeNull();
    const standardTitleX = Math.min(...standardTitleXs);
    // Libraryは共通枠より右へ押し込まず、作業面側の32px基準へ寄せる。
    expect(standardTitleX - libraryTitleX!).toBeGreaterThanOrEqual(0);
    expect(standardTitleX - libraryTitleX!).toBeLessThanOrEqual(4);
    // Settingsだけは左目次208px＋間隔40pxの後ろに本文を置く。
    expect(settingsTitleX! - standardTitleX).toBeGreaterThanOrEqual(246);
    expect(settingsTitleX! - standardTitleX).toBeLessThanOrEqual(250);
  });
});
