import { test, expect } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

// 2026-07-31 の刷新で決めた「幅ごとの見え方」を機械で守る。
// 直したのは次の3つで、どれも実際に壊れていたもの:
//  1. 900px の横長画面にスマホ用の下部タブバーが出ていた
//  2. 中間幅で Settings の目次が横スクロールの帯になり、後ろの節が押せなかった
//  3. 選択トグル(閲覧/選択/並べ替え)が実行ボタンと同じ黒塗りだった
// 読み取り専用。保存・削除・追加は一切押さない。
test.describe("admin — 幅ごとの土台", () => {
  test("中間幅でも左ナビを使い、スマホ用の下部バーを出さない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "幅を明示して確認する");
    await loginAsAdmin(page);

    // 境界そのもの(768 / 767)と、旧しきい値だった 1024 を必ず含める。
    for (const width of [1440, 1200, 1199, 1180, 1024, 900, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      await expect(
        page.locator(".admin-bottom-nav"),
        `${width}px で下部タブバーが出てはいけない`,
      ).toBeHidden();
      await expect(
        page.locator(".admin-sidebar"),
        `${width}px で左ナビが必要`,
      ).toBeVisible();
    }

    // 767px 以下だけがスマホ扱い。境界の 767 で確認する。
    await page.setViewportSize({ width: 767, height: 900 });
    await page.waitForTimeout(250);
    await expect(page.locator(".admin-bottom-nav")).toBeVisible();
  });

  test("Settingsの目次は中間幅でも縦のまま、全節へ到達できる", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "幅を明示して確認する");
    await loginAsAdmin(page);
    await gotoAdminTab(page, "settings");

    // This checks the full navigation when the preview is closed.
    const workspace = page.locator(".admin-settings-workspace");
    await expect(workspace).toBeVisible();
    const closePreview = page.getByRole("button", { name: "プレビューを閉じる" });
    if (await workspace.getAttribute("data-preview") === "true") await closePreview.click();
    await expect(workspace).toHaveAttribute("data-preview", "false");

    for (const width of [1440, 1199, 1024, 900, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      const nav = page.locator(".admin-form-toc__nav");
      await expect(nav, `${width}px で目次が必要`).toBeVisible();

      // 縦積み = ボタンの左端が全部そろっている。横帯になると左端がばらける。
      const lefts = await nav
        .locator("button[data-settings-section-link]")
        .evaluateAll((buttons) =>
          buttons.map((button) => Math.round(button.getBoundingClientRect().x)),
        );
      expect(lefts.length).toBeGreaterThan(10);
      expect(
        Math.max(...lefts) - Math.min(...lefts),
        `${width}px で目次が横に流れている`,
      ).toBeLessThanOrEqual(1);

      // 右へはみ出して押せない節が無いこと。
      const overflowing = await nav
        .locator("button[data-settings-section-link]")
        .evaluateAll(
          (buttons, limit) =>
            buttons.filter(
              (button) => button.getBoundingClientRect().right > limit,
            ).length,
          width,
        );
      expect(overflowing, `${width}px で画面外の節がある`).toBe(0);
    }
  });

  test("Libraryの選択トグルは実行ボタンと同じ黒塗りにしない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "1440pxで確認する");
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    const paper = await page.evaluate(() =>
      getComputedStyle(
        document.querySelector(".admin-atelier") as HTMLElement,
      ).getPropertyValue("--admin-ink"),
    );
    expect(paper.trim().length).toBeGreaterThan(0);

    // 選択は薄い面で示し、取り込みの強い塗りと区別する。
    // color-mix() は color(srgb ...) として返るため、正規表現でRGB扱いしない。
    const selected = page.locator('[data-library-mode-action="normal"]');
    const style = await selected.evaluate((el) => {
      const pixel = (color: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      };
      const cs = getComputedStyle(el);
      const unselected = document.querySelector('[data-library-mode-action="select"]')!;
      return { bg: pixel(cs.backgroundColor), unselectedBg: pixel(getComputedStyle(unselected).backgroundColor) };
    });
    expect(style.bg[3], "選択中の面が見える").toBeGreaterThan(0);
    const modeAlpha = style.bg[3] / 255;
    const modeOnPaper = style.bg.slice(0, 3).map(channel => channel * modeAlpha + 247 * (1 - modeAlpha));
    expect(Math.min(...modeOnPaper), "実行ボタンの濃い塗りとは区別する").toBeGreaterThan(150);
    expect(style.bg, "選択中と未選択を区別できる").not.toEqual(style.unselectedBg);
    await expect(selected).toHaveAttribute("aria-pressed", "true");

    // 取り込む(その画面で一番強い1操作)だけは黒塗りのまま。
    // 透明度を見ないと「透明な黒」でも成功してしまうので、紙へ合成して判定する。
    const importButton = page.locator(".admin-library-import-button");
    const importBg = await importButton.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const importParts = (importBg.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    expect(importParts.length).toBeGreaterThanOrEqual(3);
    const importAlpha = importParts.length >= 4 ? importParts[3] : 1;
    expect(importAlpha, `取り込むが透明になっている: ${importBg}`).toBeGreaterThan(
      0.9,
    );
    const importComposited = importParts
      .slice(0, 3)
      .map((channel) => channel * importAlpha + 247 * (1 - importAlpha));
    expect(Math.max(...importComposited)).toBeLessThan(120);

    // 取り込みは選択モードでも残る(移設時に通常モード限定へ入れて消していた)。
    await page.locator('[data-library-mode-action="select"]').click();
    await page.waitForTimeout(400);
    await expect(
      page.locator("[data-library-exit-actions] .admin-library-import-button"),
      "選択モードでも取り込めること",
    ).toBeVisible();
  });
});

test.describe("admin — 折りたたんだ左ナビ", () => {
  test("レールから全タブへ実際に移動できる", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PC幅のレールで検証");
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);
    await page.locator("[data-sidebar-collapse]").click();
    await page.waitForTimeout(300);

    const rail = page.locator(".admin-sidebar-compact");
    await expect(rail).toBeVisible();

    // 表示されているだけでなく、押して実際に画面が変わることを見る。
    for (const [group, tab, heading] of [
      ["presentation", "hero", "トップの写真"],
      ["presentation", "series", "シリーズ"],
      ["site", "settings", "サイトデザイン"],
      ["photos", "gallery", "写真一覧"],
    ] as const) {
      const groupButton = rail.locator(
        `[data-compact-sidebar-group="${group}"]`,
      );
      await groupButton.click();
      await page.waitForTimeout(200);
      const popover = rail.locator(
        `[data-compact-sidebar-popover="${group}"]`,
      );
      if (await popover.count()) {
        // 別の要素に覆われていたらこのクリックが失敗する。
        await popover.locator(`[data-compact-sidebar-item]`).filter({
          hasText: new RegExp(heading, "i"),
        }).first().click({ timeout: 5000 });
      }
      await expect(
        page.locator("h1.admin-page-header__title"),
        `${tab} へ移動できること`,
      ).toHaveText(new RegExp(heading, "i"), { timeout: 10_000 });
    }

    // 元に戻せること。
    await page.locator("[data-compact-sidebar-expand]").click();
    await expect(page.locator(".admin-sidebar__title")).toBeVisible();
  });
});
