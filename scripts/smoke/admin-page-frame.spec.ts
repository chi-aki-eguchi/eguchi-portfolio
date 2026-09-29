import { test, expect } from "./fixtures.ts";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

// Photo workspaces use compact headings; the site editor names the opened part
// above its settings, beside the preview.
// Each screen must still identify itself visibly, inside the content area,
// without reserving an oversized heading above the photographs.
for (const width of [1440, 1024, 375]) {
  test(`admin — ${width}pxで全9タブの現在地が画面内に表示される`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== (width === 375 ? "mobile" : "desktop"));
    await page.setViewportSize({ width, height: 900 });
    await loginAsAdmin(page);
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      // サイトの設定（2026-09-29〜）は、プレビューの右の欄に開いた部分の名前を出す。
      // About の文章（profile）も 2026-09-30 からここで直す。
      const settings = tab === "settings" || tab === "profile";
      // 名前の左には一覧と同じ目印が付くので、目印と名前の1行で測る。
      const heading = settings
        ? page.locator(".se-part-head__row")
        : page.locator("h1.admin-page-header__title");
      await expect(heading, `${tab}の現在地`).toBeVisible();
      await expect(heading).toBeInViewport();
      const box = await heading.boundingBox();
      const content = await page.locator(settings ? ".admin-settings-workspace__form" : ".admin-content").boundingBox();
      expect(box).not.toBeNull();
      expect(content).not.toBeNull();
      expect(box!.x, `${tab}の左余白`).toBeGreaterThanOrEqual(content!.x + 8);
      expect(box!.x, `${tab}の左余白`).toBeLessThanOrEqual(content!.x + 40);
      expect(box!.x + box!.width).toBeLessThanOrEqual(content!.x + content!.width);
      expect(box!.height, `${tab}の見出しが縦積みにならない`).toBeLessThanOrEqual(44);
    }
    if (width >= 1024) {
      // 見ながら直す画面は、プレビューと設定をいつも並べる（閉じるボタンは無い）。
      await expect(page.getByRole("button", { name: "プレビューを閉じる", exact: true })).toHaveCount(0);
      await expect(page.locator(".studio-preview-frame")).toBeVisible();
      await expect(page.locator(".se-part-head__title")).toBeVisible();
    }
  });
}
