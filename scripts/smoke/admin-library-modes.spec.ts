import { expect, test, type Page } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

const library = (page: Page) => page.locator("[data-library-mode]");
const tiles = (page: Page) => page.locator(".admin-photo-tile");
const photoAction = (page: Page, index: number) =>
  tiles(page).nth(index).locator("[data-library-photo-action]");
const modeAction = (page: Page, action: string) =>
  page.locator(`[data-library-mode-action="${action}"]`);

test.describe("admin — Libraryの通常・選択・並べる分離", () => {
  test("通常は詳細、選択は選択だけ、並べるは並べ替えだけを行う", async ({
    page,
  }, testInfo) => {
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    const count = await tiles(page).count();
    test.skip(count < 2, "モード分離を確認できる写真が2枚以上必要");

    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-library-arrange-toolbar]")).toHaveCount(0);
    await expect(
      tiles(page).first().locator(
        'button:not([data-library-photo-action])[aria-label*="90"]',
      ),
    ).toHaveCount(0);
    await expect(
      tiles(page)
        .first()
        .locator('button:not([data-library-photo-action])')
        .getByRole("button", { name: /移動|Move/ }),
    ).toHaveCount(0);

    // 通常モードのタイル操作は詳細だけを開き、一括操作は出さない。
    await photoAction(page, 0).click();
    await expect(page.locator("[data-library-inspector]")).toBeVisible();
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );

    // 詳細を開いたまま選択へ切り替えると、未編集なら詳細を閉じて0枚から始まる。
    // ただしスマホ幅では、詳細が右側の全高オーバーレイとしてモード切替を覆うため
    // この遷移が物理的に行えない（既知欠陥。承認済み設計 §2-2 の「下側シート」が
    // 入るまで解消しない。追跡は task-queue.md Q-11、専用の fixme を下に置いた）。
    // ここで詳細を閉じるのは欠陥の回避ではなく、以降の検証を続けるための前処理。
    if (testInfo.project.name === "mobile") {
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    }
    await modeAction(page, "select").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "select");
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveAttribute(
      "data-library-selected-count",
      "0",
    );

    await photoAction(page, 0).click();
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveAttribute(
      "data-library-selected-count",
      "1",
    );
    await expect(page.locator("[data-library-batch-actions]")).toBeVisible();
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);

    // Shift範囲選択は既存の高速操作として維持する。
    await photoAction(page, 1).click({ modifiers: ["Shift"] });
    await expect
      .poll(async () =>
        Number(
          await page
            .locator("[data-library-selection-toolbar]")
            .getAttribute("data-library-selected-count"),
        ),
      )
      .toBeGreaterThanOrEqual(2);
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);

    await modeAction(page, "end-select").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );

    // Ctrl/Cmdクリックも、詳細ではなく選択モードへの近道として維持する。
    // macOS では Control+クリックが右クリックとして扱われ onClick が発火しない。
    // ControlOrMeta は macOS で Meta、Windows/Linux で Control に解決される。
    await photoAction(page, 0).click({ modifiers: ["ControlOrMeta"] });
    await expect(library(page)).toHaveAttribute("data-library-mode", "select");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveAttribute(
      "data-library-selected-count",
      "1",
    );
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    await modeAction(page, "end-select").click();

    // 並べるモードはタイルクリックで詳細も一括選択も開かない。
    await modeAction(page, "arrange").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "arrange");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    await expect(photoAction(page, 0)).toHaveAttribute("class", /cursor-grab/);
    await expect(tiles(page).first()).toHaveAttribute("draggable", "true");
    await photoAction(page, 0).click();
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );

    await modeAction(page, "finish-arrange").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
    await expect(tiles(page).first()).toHaveAttribute("draggable", "false");
  });

  test("検索中は並べ替えをロックし、検索結果0件を区別する", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "表示条件とロック理由はdesktopで1回確認すれば十分",
    );
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    test.skip((await tiles(page).count()) === 0, "検索対象の写真が必要");

    await page.locator("[data-library-filters-toggle]").click();
    await page
      .locator("[data-library-search-input]")
      .fill("__library_mode_no_result__");
    await expect(page.locator('[data-library-empty="search"]')).toBeVisible();

    await modeAction(page, "arrange").click();
    await expect(page.locator("[data-library-arrange-toolbar]")).toHaveAttribute(
      "data-reorder-locked",
      "true",
    );
    await expect(page.locator("[data-library-arrange-toolbar]")).toHaveAttribute(
      "data-reorder-lock-cause",
      "filters",
    );
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );
  });

  test("写真0枚では空状態を示し、選択・並べるを開始しない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "空ライブラリはAPIを読み取り専用で差し替えてdesktopで確認",
    );
    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos: [] }),
      });
    });
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    await expect(page.locator('[data-library-empty="photos"]')).toBeVisible();
    await expect(modeAction(page, "select")).toBeDisabled();
    await expect(modeAction(page, "arrange")).toBeDisabled();
    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
  });

  // 既知欠陥（2026-07-25 オーナー判断で次段へ切り出し・task-queue.md Q-11）。
  // 390px では写真詳細が `fixed inset-y-0 right-0` の全高オーバーレイとして出るため、
  // 通常/選択/並べるの切替ボタンを覆って押せなくなる。承認済み設計
  // (docs/specs/library-redesign-spec.md §2-2) は「390px は下側シート」であり、
  // 下側シートを実装すればこの fixme は外せる。skip ではなく fixme にしているのは、
  // 欠陥を緑の中に埋もれさせず、レポート上に残し続けるため。
  test.fixme(
    "スマホ幅で詳細を開いたままモード切替できる（下側シート実装まで未達・Q-11）",
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "スマホ幅のみの欠陥");
      await loginAsAdmin(page);
      await gotoAdminTab(page, "gallery");
      test.skip((await tiles(page).count()) < 1, "写真が1枚以上必要");

      await photoAction(page, 0).click();
      await expect(page.locator("[data-library-inspector]")).toBeVisible();
      // 下側シートになれば、詳細を開いたままでもモード切替に手が届く。
      await modeAction(page, "select").click({ timeout: 3000 });
      await expect(library(page)).toHaveAttribute("data-library-mode", "select");
    },
  );
});
