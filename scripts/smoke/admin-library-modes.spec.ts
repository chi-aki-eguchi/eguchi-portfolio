import { expect, test, type Page } from "./fixtures.ts";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

const library = (page: Page) => page.locator("[data-library-mode]");
const tiles = (page: Page) => page.locator(".admin-photo-tile");
const photoAction = (page: Page, index: number) =>
  tiles(page).nth(index).locator("[data-library-photo-action]");
const dragHandle = (page: Page, index: number) =>
  tiles(page)
    .nth(index)
    .getByRole("button", { name: /ドラッグして並べ替え|Drag to reorder/ });
/**
 * モードの入口。**スマホ幅には3つ並ぶ切替が出ない**ので、同じモードへ入る
 * 操作帯の専用ボタンを代わりに使う（`data-library-mobile-select` /
 * `data-library-mobile-arrange`）。ここを見ていなかったので、スマホの検査は
 * 「選択に入れない」で落ち続けていた。
 */
const modeAction = (page: Page, action: string) =>
  page
    .locator(
      `[data-library-mode-action="${action}"]:visible, [data-library-mobile-${action}]:visible`,
    )
    .first();

/**
 * そのモードへ入る。
 *
 * スマホ幅は**並べ替え中に切替そのものを出さない**（画面が狭いので、並べ替えを
 * 終えてから次へ進む形）。その状態から他のモードを押そうとして、スマホの検査は
 * ずっと時間切れになっていた。先に「並べ替えを終了」を押してから入る。
 */
async function enterMode(
  page: Page,
  mode: "normal" | "select" | "arrange",
): Promise<void> {
  const direct = modeAction(page, mode);
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  const finishArrange = page
    .locator('[data-library-mode-action="finish-arrange"]:visible')
    .first();
  if (await finishArrange.isVisible()) {
    await finishArrange.click();
    // 「並べ替えを終了」は通常へ戻る。目的地が通常ならそれで着いている。
    if (mode === "normal") return;
    await modeAction(page, mode).click();
    return;
  }
  if (mode === "normal") {
    // スマホの選択中は「選択終了」で通常へ戻る（切替は出ていない）。
    const cancel = page.locator(".admin-selection-cancel:visible").first();
    if (await cancel.isVisible()) await cancel.click();
    return;
  }
  await modeAction(page, mode).click();
}

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

    // 一覧へ戻り、選択へ切り替えると0枚から始まる。
    await page.locator("[data-library-inspector-close]").click();
    await enterMode(page, "select");
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
    await enterMode(page, "arrange");
    await expect(library(page)).toHaveAttribute("data-library-mode", "arrange");
    await expect(page.locator("[data-library-reorder-bar]")).toHaveCount(0);
    await photoAction(page, 0).click();
    await expect(page.locator("[data-library-reorder-bar]")).toBeVisible();
    await expect(
      tiles(page).nth(0).locator("[data-library-reorder-target-pill]"),
    ).toBeVisible();
    // ここから先は**画面幅で道が分かれる**。
    //  PC: 並べ替え → 選択 へ直接戻れるので、隠していた選択集合が復元する。
    //  スマホ: 切替が出ないので「並べ替えを終了」→通常 を通るしかなく、
    //          そこで選択は終わる（`applyLibraryMode` の keepSelection は
    //          arrange→select だけ）。**スマホには復元まで戻る道が無い**ことを
    //          そのまま書いておく（隠すと、直すかどうかの判断材料が消える）。
    const narrow = (page.viewportSize()?.width ?? 0) < 768;
    await enterMode(page, "select");
    await expect(library(page)).toHaveAttribute("data-library-mode", "select");
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveAttribute(
      "data-library-selected-count",
      narrow ? "0" : (selectedCount ?? "0"),
    );

    await enterMode(page, "normal");
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
    await enterMode(page, "normal");

    // 並べ替えモードはタイルクリックで対象だけを指定する。
    await enterMode(page, "arrange");
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

    await enterMode(page, "normal");
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
    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          photos: [{
            id: 99001,
            url: "/api/images/smoke.jpg",
            thumbUrl: "/api/images/smoke-thumb.jpg",
            filename: "smoke.jpg",
            title: "Smoke fixture",
            published: true,
            sortOrder: 1,
            displaySize: "M",
            rotation: 0,
            focalX: 0.5,
            focalY: 0.5,
          }],
        }),
      });
    });
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    test.skip((await tiles(page).count()) === 0, "検索対象の写真が必要");

    await page
      .locator("[data-library-search-input]")
      .fill("__library_mode_no_result__");
    await expect(page.locator('[data-library-empty="search"]')).toBeVisible();
    await expect(page.locator('[data-library-empty="search"] svg')).toHaveCount(0);
    await expect(page.locator('[data-library-empty="search"] p')).toHaveCount(1);
    await expect(page.locator("[data-library-filter-count]")).toHaveCount(0);
    await expect(
      page.locator('[data-library-active-condition="search"]'),
    ).toBeVisible();

    await page.locator("[data-library-filters-toggle]").click();
    await page.getByText("その他の条件", { exact: true }).click();
    const publicationFilter = page.getByRole("combobox", {
      name: "公開状態で絞り込み",
    });
    await publicationFilter.selectOption("unpublished");
    await page.getByRole("button", { name: "絞り込みを閉じる" }).click();
    await expect(page.locator("[data-library-filter-count]")).toHaveText("1");
    await expect(page.locator("[data-library-active-condition]")).toHaveCount(
      2,
    );
    await page
      .locator("[data-library-active-conditions]")
      .getByRole("button", { name: "すべて解除" })
      .click();
    await expect(page.locator("[data-library-active-conditions]")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-library-search-input]")).toHaveValue("");
    await page.locator("[data-library-filters-toggle]").click();
    await page.getByText("その他の条件", { exact: true }).click();
    await expect(publicationFilter).toHaveValue("all");
    await page.getByRole("button", { name: "絞り込みを閉じる" }).click();

    await page
      .locator("[data-library-search-input]")
      .fill("__library_mode_no_result__");
    await expect(page.locator('[data-library-empty="search"]')).toBeVisible();

    // 絞り込み中の「並べ替え」は、押せなくするのではなく**押したら解除して
    // 入る**（2026-09-13 `208c1e1`/`2031c56`。単体は
    // `admin-reorder-lock.render.test.tsx`）。押せない状態にするのは
    // 「公開の並びが手動順でない」ときだけで、理由が違う。
    const arrange = modeAction(page, "arrange");
    await expect(arrange).toBeEnabled();
    await expect(arrange).toHaveAttribute("title", /解除して並べ替える/);
    await expect(
      page.locator('[data-library-reorder-entry-lock="filters"]'),
    ).toBeVisible();
    // 押す前は並べ替えに入っていない。
    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
    await expect(page.locator("[data-library-arrange-toolbar]")).toHaveCount(0);
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    await expect(page.locator("[data-library-selection-toolbar]")).toHaveCount(
      0,
    );

    await page.getByRole("button", { name: "解除して並べ替える" }).click();
    await expect(library(page)).toHaveAttribute("data-library-mode", "arrange");
    await expect(page.locator("[data-library-arrange-toolbar]")).toHaveAttribute(
      "data-reorder-locked",
      "false",
    );
    // 「解除して」の部分。条件が残ったまま並べ替えに入ると、見えている一部だけを
    // 動かして全体の並びを保存してしまう。並べ替え中は検索欄そのものを出さない
    // ので、通常へ戻して**本当に消えている**ことを見る（隠れているだけではない）。
    await expect(page.locator("[data-library-active-conditions]")).toHaveCount(0);
    await enterMode(page, "normal");
    await expect(library(page)).toHaveAttribute("data-library-mode", "normal");
    await expect(page.locator("[data-library-search-input]")).toHaveValue("");
    await expect(page.locator("[data-library-active-conditions]")).toHaveCount(0);
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

  test("写真APIの失敗を静かな1行で示し、再読み込みできる", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API差し替えはdesktopで1回確認");
    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    const error = page.locator("[data-library-load-error]");
    await expect(error).toBeVisible();
    await expect(error).toContainText("写真を読み込めませんでした");
    await expect(error.getByRole("button", { name: "再読み込み" })).toBeVisible();
    await expect(error.locator("p, svg")).toHaveCount(0);
  });

  // 390pxでも写真編集から一覧へ戻って選択を開始できる。
  test(
    "スマホ幅で写真編集から戻り、選択を開始できる",
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "スマホ幅のみの挙動");
      await loginAsAdmin(page);
      await gotoAdminTab(page, "gallery");
      test.skip((await tiles(page).count()) < 1, "写真が1枚以上必要");

      await photoAction(page, 0).click();
      await expect(page.locator("[data-library-inspector]")).toBeVisible();
      await page.locator("[data-library-inspector-close]").click();
      await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
      await modeAction(page, "select").click({ timeout: 3000 });
      await expect(library(page)).toHaveAttribute("data-library-mode", "select");
    },
  );
});
