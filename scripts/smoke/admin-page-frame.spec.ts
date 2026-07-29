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

    const formTitleXs: number[] = [];
    const workspaceTitleXs: number[] = [];
    let settingsTitleX: number | null = null;
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      // 画面切替の横移動が完全に終わってから、静止位置だけを比べる。
      await page.waitForTimeout(300);
      const title = page.locator("h1.admin-page-header__title");
      await expect(title, `${tab} に共通見出しが必要`).toHaveCount(1);
      const box = await title.boundingBox();
      expect(box, `${tab} の見出し位置を取得できること`).not.toBeNull();
      if (tab === "settings") settingsTitleX = box!.x;
      else if (["gallery", "hero", "series"].includes(tab))
        workspaceTitleXs.push(box!.x);
      else formTitleXs.push(box!.x);
    }

    expect(
      Math.max(...formTitleXs) - Math.min(...formTitleXs),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.max(...workspaceTitleXs) - Math.min(...workspaceTitleXs),
    ).toBeLessThanOrEqual(2);
    expect(settingsTitleX).not.toBeNull();
    const formTitleX = Math.min(...formTitleXs);
    const workspaceTitleX = Math.min(...workspaceTitleXs);
    // Workspaceは共通Formより右へ押し込まず、全幅作業面の32px基準へ寄せる。
    expect(formTitleX - workspaceTitleX).toBeGreaterThanOrEqual(0);
    expect(formTitleX - workspaceTitleX).toBeLessThanOrEqual(8);
    // Settingsだけは左目次208px＋間隔40pxの後ろに本文を置く。
    expect(settingsTitleX! - formTitleX).toBeGreaterThanOrEqual(246);
    expect(settingsTitleX! - formTitleX).toBeLessThanOrEqual(250);
  });
});
