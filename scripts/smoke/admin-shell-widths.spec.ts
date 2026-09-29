import { test, expect } from "./fixtures.ts";
import { backToSiteList, gotoAdminTab, loginAsAdmin } from "./helpers";

// 2026-07-31 の刷新で決めた「幅ごとの見え方」を機械で守る。
// 直したのは次の3つで、どれも実際に壊れていたもの:
//  1. 900px の横長画面にスマホ用の下部タブバーが出ていた
//  2. 中間幅で Settings の目次が横スクロールの帯になり、後ろの節が押せなかった
//  3. 選択トグル(閲覧/選択/並べ替え)が実行ボタンと同じ黒塗りだった
// 2026-09-29 に管理画面を「写真・シリーズ・サイト」の1つの器にし、「サイト」を
// 公開サイトを見ながら直す画面にした。左ナビと下部タブバーは無くなり、1・2は
// サイトの画面（プレビューと右の一覧）で同じことを確かめる。
// 読み取り専用。保存・削除・追加は一切押さない。
test.describe("admin — 幅ごとの土台", () => {
  test("900px以上はプレビューと右の一覧が並び、それより狭いと1画面ずつになる", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "幅を明示して確認する");
    await loginAsAdmin(page);
    await gotoAdminTab(page, "settings");
    await backToSiteList(page);

    // 境界そのもの(900 / 899 / 768 / 767)と、旧しきい値だった 1024 を必ず含める。
    for (const width of [1440, 1200, 1024, 900, 899, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      await expect(page.locator(".admin-book__tabs"), `${width}px で入口が必要`).toBeVisible();
      await expect(page.locator(".se-bar"), `${width}px でページの帯が必要`).toBeVisible();
      await expect(page.locator(".se-parts"), `${width}px で一覧が必要`).toBeVisible();

      // 縦積み = 行の左端が全部そろっている。横帯になると左端がばらける。
      const lefts = await page.locator(".se-parts [data-site-part]").evaluateAll((rows) =>
        rows.map((row) => Math.round(row.getBoundingClientRect().x)),
      );
      expect(lefts.length).toBeGreaterThan(3);
      expect(Math.max(...lefts) - Math.min(...lefts), `${width}px で一覧が横に流れている`).toBeLessThanOrEqual(1);

      const frame = page.locator(".studio-preview-frame");
      if (width >= 900) {
        await expect(frame, `${width}px ではプレビューを横に出す`).toBeVisible();
        const preview = await frame.boundingBox();
        const list = await page.locator(".se-parts").boundingBox();
        expect(preview && list && preview.x + preview.width <= list.x, `${width}px でプレビューが左、一覧が右`).toBe(true);
      } else {
        await expect(frame, `${width}px では編集とプレビューを切り替える`).toBeHidden();
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${width}px で横にはみ出さない`).toBeLessThanOrEqual(1);
    }

    // 767px 以下はスマホ扱い。部分を開くと一覧は隠れ、戻るで一覧へ戻る。
    await page.setViewportSize({ width: 767, height: 900 });
    await page.waitForTimeout(250);
    await page.locator('.se-parts [data-site-part="name"]').click();
    await expect(page.locator(".se-part-head__back")).toBeVisible();
    await expect(page.locator(".se-parts")).toHaveCount(0);
    await page.locator(".se-part-head__back").click();
    await expect(page.locator(".se-parts")).toBeVisible();
    await expect(page.locator('[data-settings-section="name"]')).toBeHidden();
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
