import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

function relativeLuminance(color: string) {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Expected an rgb color, received ${color}`);
  }
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// 回帰テスト(工程2 fix #9): 通常ボタンのリセットルール((0,5,1))が
// 選択済み/プライマリボタンの強調ルール((0,3,1))より詳細度が高く、
// Series のレイアウト選択ボタン等が選択済みでも強調表示にならなかった
// (className 上は正しく選択状態だが、computed style が変わらない)不具合。
test.describe("admin — 選択済みボタンが実際にハイライト表示される", () => {
  test("Seriesのレイアウト選択ボタンは選択すると背景がinkトーンになる", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Series" }).click();
    await page.waitForTimeout(1000);

    const editBtn = page.getByRole("button", { name: "編集" }).first();
    await editBtn.click();
    await page.waitForTimeout(400);

    const layoutBtn = page.getByRole("button", { name: "モザイク" }).first();
    await layoutBtn.click();
    await page.waitForTimeout(300);

    const bg = await layoutBtn.evaluate((el) => getComputedStyle(el).color);
    // --admin-ink は rgb(46, 44, 39) 系统。選択後もリセット側の色のままなら未修正。
    expect(bg).not.toBe("rgb(46, 44, 39)");
  });

  test("写真編集の選択中ラベルは明暗両テーマで指示子から読める", async ({
    page,
  }, testInfo) => {
    await loginAsAdmin(page);
    await page
      .locator(".admin-photo-tile [data-library-photo-action]")
      .first()
      .click();

    const inspector = page.locator("[data-library-inspector]");
    await expect(inspector).toBeVisible();
    const selectedOption = inspector
      .locator('.admin-segmented__option[aria-pressed="true"]')
      .first();
    const indicator = inspector.locator(".admin-segmented__indicator").first();
    await expect(selectedOption).toBeVisible();
    await expect(indicator).toBeVisible();

    if (testInfo.project.name === "mobile") {
      await testInfo.attach("390px-photo-inspector.png", {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }

    const themes = [
      { name: "light", ink: "#1a1a1a", paper: "#f7f4ed" },
      { name: "dark", ink: "#f0ede5", paper: "#161616" },
    ];

    for (const theme of themes) {
      await selectedOption.evaluate((element, colors) => {
        (element as HTMLElement).style.setProperty("--admin-paper", colors.paper);
      }, theme);
      await indicator.evaluate((element, colors) => {
        (element as HTMLElement).style.setProperty("--admin-ink", colors.ink);
      }, theme);
      // The control intentionally animates color changes. Measure the settled
      // state so an in-between animation frame is not mistaken for contrast.
      await page.waitForTimeout(250);

      const [textColor, indicatorColor] = await Promise.all([
        selectedOption.evaluate((element) => getComputedStyle(element).color),
        indicator.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      ]);
      expect(
        contrastRatio(textColor, indicatorColor),
        `${theme.name}: ${textColor} on ${indicatorColor}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
