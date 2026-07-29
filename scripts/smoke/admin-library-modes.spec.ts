import { expect, test, type Page } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

const library = (page: Page) => page.locator("[data-library-mode]");
const tiles = (page: Page) => page.locator(".admin-photo-tile");
const photoAction = (page: Page, index: number) =>
  tiles(page).nth(index).locator("[data-library-photo-action]");
const dragHandle = (page: Page, index: number) =>
  tiles(page)
    .nth(index)
    .getByRole("button", { name: /ドラッグして並べ替え|Drag to reorder/ });
const modeAction = (page: Page, action: string) =>
  page.locator(`[data-library-mode-action="${action}"]:visible`).first();

test.describe("admin — Libraryの通常・選択・並べる分離", () => {
  test("通常は詳細、選択は選択だけ、並べるは並べ替えだけを行う", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    const count = await tiles(page).count();
    test.skip(count < 2, "モード分離を確認できる写真が2枚以上必要");

    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-library-arrange-toolbar]")).toHaveCount(0);
    await expect(dragHandle(page, 0)).toHaveCount(0);
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

    // 選択を維持したまま検索でき、表示外になった選択枚数も分かる。
    await expect(page.locator("[data-library-filters-toggle]")).toBeVisible();
    await page.locator("[data-library-filters-toggle]").click();
    const searchInput = page.locator("[data-library-search-input]");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("__library_mode_no_result__");
    await expect(page.locator("[data-library-selection-toolbar]")).toContainText(
      /選択中 1枚（うち1枚は絞り込みの外）|1 selected \(1 outside filters\)/,
    );
    await searchInput.fill("");
    await expect(page.locator("[data-library-selection-toolbar]")).toContainText(
      /選択中 1枚|1 selected/,
    );
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).not.toContainText(/絞り込みの外|outside filters/);

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

    const selectedCount = await page
      .locator("[data-library-selection-toolbar]")
      .getAttribute("data-library-selected-count");
    // 選択集合と並べ替え対象は別。選択→並べ替えでは対象なしで入り、
    // 写真を対象にしても選択集合は隠して保持し、選択へ戻ると復元する。
    await modeAction(page, "arrange").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "arrange");
    await expect(page.locator("[data-library-reorder-bar]")).toHaveCount(0);
    await photoAction(page, 0).click();
    await expect(page.locator("[data-library-reorder-bar]")).toBeVisible();
    await expect(
      tiles(page).nth(0).locator("[data-library-reorder-target-pill]"),
    ).toBeVisible();
    await modeAction(page, "select").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "select");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveAttribute(
      "data-library-selected-count",
      selectedCount ?? "0",
    );

    await modeAction(page, "end-select").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(0);

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

    // 並べ替えモードはタイルクリックで対象だけを指定する。
    await modeAction(page, "arrange").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "arrange");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    // 写真全体ではなく取っ手だけがドラッグ元。通常モードには取っ手がなく、
    // 並べるモードで初めて draggable な取っ手が現れる。
    await expect(dragHandle(page, 0)).toHaveAttribute("draggable", "true");
    await expect(photoAction(page, 0)).not.toHaveAttribute("draggable", "true");
    await photoAction(page, 0).click();
    await expect(page.locator("[data-library-reorder-bar]")).toBeVisible();
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-library-filters-toggle]")).toHaveCount(0);
    await expect(
      tiles(page)
        .first()
        .locator("button:not([data-library-photo-action])"),
    ).toHaveCount(1);

    await modeAction(page, "finish-arrange").click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
    await expect(dragHandle(page, 0)).toHaveCount(0);
    await expect(photoAction(page, 0)).not.toHaveAttribute("draggable", "true");
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

  // 390px では詳細を下側シートで出すため、開いたままでも通常/選択/並べるを切り替えられる。
  test(
    "スマホ幅で詳細を開いたままモード切替できる（下側シート）",
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "スマホ幅のみの挙動");
      await loginAsAdmin(page);
      await gotoAdminTab(page, "gallery");
      test.skip((await tiles(page).count()) < 1, "写真が1枚以上必要");

      await photoAction(page, 0).click();
      await expect(page.locator("[data-library-inspector]")).toBeVisible();
      const inspectorBox = await page
        .locator("[data-library-inspector]")
        .boundingBox();
      const selectModeBox = await modeAction(page, "select").boundingBox();
      expect(inspectorBox).not.toBeNull();
      expect(selectModeBox).not.toBeNull();
      expect(inspectorBox!.y).toBeGreaterThan(
        selectModeBox!.y + selectModeBox!.height,
      );
      // 下側シートになれば、詳細を開いたままでもモード切替に手が届く。
      await modeAction(page, "select").click({ timeout: 3000 });
      await expect(library(page)).toHaveAttribute("data-library-mode", "select");
    },
  );
});
