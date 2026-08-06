import { test, expect, type Page, type Route } from "@playwright/test";
import { loginAsAdmin, gotoAdminTab } from "./helpers";

// 2026-07-11 スマホLibraryコンタクトシート化の回帰テスト。
// thumbSize(初期220px)はスマホでslider非表示のため変更できず、375/390px幅の
// Libraryが1列に落ちて写真が1枚ずつしか見えなかった。実測grid幅ベースの
// effectiveLibraryThumbSize で最低2列を保証する。
// ここでは 表示列数 / 横はみ出し / カード上ボタンの収まり / タイルタップ→
// Inspector表示 のみ検証する — Save/Delete/Add 等の書き込みは一切行わない
// (Inspectorは開いて閉じるだけ。編集なしの×は即閉じで確認も出ない)。

const tileGrid = (page: Page) =>
  page.locator(".admin-photo-tile").first().locator("xpath=..");

async function assertContactSheet(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await gotoAdminTab(page, "gallery");
  const tiles = page.locator(".admin-photo-tile");
  const count = await tiles.count();
  expect(count, "Libraryに写真が2枚以上ある前提").toBeGreaterThanOrEqual(2);

  // 実測反映(ResizeObserver→state)後に2列以上になるまで待つ
  await expect
    .poll(
      async () => {
        const cols = await tileGrid(page).evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        );
        return cols;
      },
      { timeout: 10_000, message: `${width}pxで2列以上` },
    )
    .toBeGreaterThanOrEqual(2);

  const twoColumns = page.getByRole("button", { name: "2列表示" });
  const threeColumns = page.getByRole("button", { name: "3列表示" });
  const viewMenu = page.locator(".admin-library-view-menu");
  if ((await viewMenu.getAttribute("open")) === null) {
    await viewMenu.locator(":scope > summary").click();
  }
  await twoColumns.click();
  await expect(twoColumns).toHaveAttribute("aria-pressed", "true");

  // 通常モードは詳細を開くための状態。回転・移動操作は写真上に置かない。
  await expect(
    tiles.nth(0).getByRole("button", { name: "右へ90度回転" }),
  ).toHaveCount(0);
  await expect(
    tiles.nth(0).getByRole("button", { name: "後へ移動" }),
  ).toHaveCount(0);

  await expect(threeColumns).toBeVisible();
  await threeColumns.click();
  await expect(threeColumns).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(
      async () =>
        tileGrid(page).evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        ),
      { timeout: 10_000, message: `${width}pxで3列表示へ切替` },
    )
    .toBe(3);
  await viewMenu.locator(":scope > summary").click();

  // 1行目の先頭2タイルが同じ高さに横並びしている(=密な複数列表示)
  const box1 = await tiles.nth(0).boundingBox();
  const box2 = await tiles.nth(1).boundingBox();
  expect(box1!.y).toBeCloseTo(box2!.y, 0);
  expect(box2!.x).toBeGreaterThan(box1!.x);

  // 横はみ出しゼロ(ページ全体・grid コンテナとも)
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - window.innerWidth,
    grids: Array.from(document.querySelectorAll(".admin-content *"))
      .filter((e) => e.classList.contains("grid"))
      .map((e) => e.scrollWidth - e.clientWidth)
      .filter((d) => d > 1),
  }));
  expect(overflow.doc).toBeLessThanOrEqual(0);
  expect(overflow.grids).toEqual([]);

  // 回帰(2026-07-12): 仮想グリッドのタイル画像はeager固定。lazyへ戻すと
  // 高速スワイプ中のremountでキャッシュ済みサムネイルまで白抜けする
  // 強いチラつきが再発する(読み取りのみの検証)。
  const lazyTileImages = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll(".admin-photo-tile img")).filter(
        (img) => img.getAttribute("loading") !== "eager",
      ).length,
  );
  expect(lazyTileImages, "Libraryタイル画像は全てloading=eager").toBe(0);

  // 回帰(Claude review P1): 画像エラー時も「読込中」の透明状態へ固定しない。
  const firstImage = tiles.nth(0).locator("img");
  await firstImage.evaluate((image) => {
    image.dataset.loaded = "false";
    image.dispatchEvent(new Event("error"));
  });
  await expect(firstImage).toHaveAttribute("data-loaded", "true");
  await expect(firstImage).toHaveAttribute("data-broken", "true");

  // 通常モードの3列は写真を一覧する密度優先なので、移動ボタンを写真上へ
  // 出さない。並べ替え開始時は2列へ切り替えるため、3列のまま覆うこともない。
  await expect(tiles.nth(0).getByRole("button", { name: "前へ移動" })).toHaveCount(
    0,
  );
  await expect(tiles.nth(0).getByRole("button", { name: "後へ移動" })).toHaveCount(
    0,
  );
  await page.locator('[data-library-mode-action="arrange"]').click();
  await expect(page.locator("[data-library-mode]")).toHaveAttribute(
    "data-library-mode",
    "arrange",
  );
  await expect
    .poll(
      async () =>
        tileGrid(page).evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        ),
      { timeout: 10_000, message: `${width}pxで並べるモードは2列` },
    )
    .toBe(2);
  await tiles.nth(0).locator("[data-library-photo-action]").click();
  const reorderBar = page.locator("[data-library-reorder-bar]");
  await expect(reorderBar).toBeVisible();
  await expect(
    reorderBar.getByRole("button", { name: "前へ移動" }),
  ).toBeVisible();
  await expect(
    reorderBar.getByRole("button", { name: "後へ移動" }),
  ).toBeVisible();
  await expect(
    reorderBar.getByRole("button", { name: "先頭へ移動" }),
  ).toBeVisible();
  await expect(
    reorderBar.getByRole("button", { name: "末尾へ移動" }),
  ).toBeVisible();
  await expect(page.locator(".admin-bottom-nav")).toHaveCount(0);

  // 写真上はドラッグ取っ手1つだけ。触ってもスクロール中扱いにしない。
  const dragButton = tiles
    .nth(0)
    .getByRole("button", { name: /ドラッグして並べ替え|Drag to reorder/ });
  await expect(
    tiles.nth(0).locator("button:not([data-library-photo-action])"),
  ).toHaveCount(1);
  await dragButton.evaluate((button) => {
    const touch = new Touch({
      identifier: 1,
      target: button,
      clientX: 20,
      clientY: 20,
    });
    button.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      }),
    );
  });
  await expect(page.locator("[data-library-scroll]")).toHaveAttribute(
    "data-scrolling",
    "false",
  );
  await expect(dragButton).toBeVisible();

  // 取っ手と下部帯が390pxの外へはみ出さない。
  const tileBox = (await tiles.nth(0).boundingBox())!;
  const dragBox = (await dragButton.boundingBox())!;
  expect(dragBox.x).toBeGreaterThanOrEqual(tileBox.x - 1);
  expect(dragBox.x + dragBox.width).toBeLessThanOrEqual(
    tileBox.x + tileBox.width + 1,
  );
  const barBox = (await reorderBar.boundingBox())!;
  expect(barBox.x).toBeGreaterThanOrEqual(0);
  expect(barBox.x + barBox.width).toBeLessThanOrEqual(width);

  await page
    .locator('[data-library-mode-action="finish-arrange"]:visible')
    .click();
  await expect(page.locator(".admin-bottom-nav")).toBeVisible();

  // タイルタップ → Inspector(モバイルはドロワー)が開く。編集していないので
  // × は即閉じ(確認ダイアログなし・非書き込み)。
  await tiles.nth(0).locator("[data-library-photo-action]").click();
  const inspector = page.locator("[data-library-inspector]");
  await expect(inspector.getByText("写真を編集")).toBeVisible({ timeout: 5_000 });
  await expect(inspector).toHaveAttribute("data-inspector-mobile-section", "basic");
  await expect(inspector.locator("[data-inspector-save-bar]")).toBeVisible();
  await expect(inspector.locator("[data-inspector-save-bar]")).toHaveAttribute(
    "data-inspector-save-state",
    "clean",
  );
  const mobileTitle = inspector.locator(".admin-inspector-mobile-title input");
  await expect(mobileTitle).toBeVisible();
  await mobileTitle.fill(`${await mobileTitle.inputValue()}確認`);
  await expect(inspector.locator("[data-inspector-save-bar]")).toHaveAttribute(
    "data-inspector-save-state",
    "dirty",
  );

  await inspector.getByRole("button", { name: "分類", exact: true }).click();
  await expect(inspector.locator("[data-inspector-classification-control]").first()).toBeVisible();
  await inspector.getByRole("button", { name: "詳細", exact: true }).click();
  await expect(inspector.locator(".admin-inspector-metadata")).toBeVisible();
  await expect(inspector.getByRole("button", { name: "この写真を複製" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "写真をゴミ箱へ" })).toBeVisible();

  await inspector
    .locator("[data-inspector-save-bar]")
    .getByRole("button", { name: "元に戻す" })
    .click();
  await expect(inspector.locator("[data-inspector-save-bar]")).toHaveAttribute(
    "data-inspector-save-state",
    "clean",
  );
  await page.locator("[data-library-inspector-close]").click();
  await expect(page.getByText("写真を編集")).toBeHidden();
}

test.describe("admin — スマホLibraryコンタクトシート", () => {
  test.describe("タッチ端末相当(pointer:coarse)", () => {
    // 実機同様に (pointer: coarse) を成立させ、40px化したタップ領域で
    // はみ出し検証する
    test.use({ hasTouch: true });

    test("375/390px幅で2列以上・はみ出しなし・タップでInspector", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile",
        "モバイル専用の検証のため mobile プロジェクトのみで実行",
      );
      await loginAsAdmin(page);
      await assertContactSheet(page, 375, 667);
      await assertContactSheet(page, 390, 844);
    });

    test("写真保存の失敗を下部バーに表示し、その場で再試行できる", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile",
        "モバイル専用の検証のため mobile プロジェクトのみで実行",
      );
      await loginAsAdmin(page);
      await gotoAdminTab(page, "gallery");
      await page.locator(".admin-photo-tile").first().locator("[data-library-photo-action]").click();

      const inspector = page.locator("[data-library-inspector]");
      const saveBar = inspector.locator("[data-inspector-save-bar]");
      const title = inspector.locator(".admin-inspector-mobile-title input");
      await title.fill(`${await title.inputValue()}失敗確認`);
      await page.route("**/api/admin/photos/*", async (route: Route) => {
        if (route.request().method() !== "PATCH") {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "test-only failure" }),
        });
      });

      await saveBar.getByRole("button", { name: "保存", exact: true }).click();
      await expect(saveBar).toHaveAttribute("data-inspector-save-state", "error");
      await expect(saveBar.getByRole("button", { name: "やり直す" })).toBeVisible();
      await saveBar.getByRole("button", { name: "元に戻す" }).click();
      await page.locator("[data-library-inspector-close]").click();
    });

    test("選択操作は下部に固定し、残りの操作もその他から届く", async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "mobileのみ");
      await loginAsAdmin(page);
      await gotoAdminTab(page, "gallery");
      await page.locator('[data-library-mode-action="select"]').click();
      await page.locator(".admin-photo-tile").first().locator("[data-library-photo-action]").click();

      const toolbar = page.locator("[data-library-selection-toolbar]");
      await expect(toolbar).toBeVisible();
      const box = (await toolbar.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(812 - 55);
      await expect(toolbar.getByText("選択中 1枚", { exact: true })).toHaveCount(1);
      await expect(toolbar.getByRole("button", { name: "選択終了" })).toBeVisible();
      await toolbar.locator(".admin-selection-more > summary").click();
      await expect(toolbar.getByRole("button", { name: "一括編集" })).toBeVisible();
      await expect(toolbar.getByRole("button", { name: "ゴミ箱へ" })).toBeVisible();
      await expect(page.getByRole("button", { name: "取り込む", exact: true })).toBeVisible();
    });

    test("作業バーは100px以下で、絞り込みを開いても写真を押し下げない", async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "mobileのみ");
      await loginAsAdmin(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAdminTab(page, "gallery");
      const workbar = page.locator(".admin-library-workbar");
      const grid = page.locator("[data-library-scroll]");
      const before = (await grid.boundingBox())!;
      expect((await workbar.boundingBox())!.height).toBeLessThanOrEqual(100);

      await page.locator("[data-library-filters-toggle]").click();
      await expect(page.locator("[data-library-filter-sheet]")).toBeVisible();
      const after = (await grid.boundingBox())!;
      expect(after.y).toBeCloseTo(before.y, 0);
      await expect(page.locator(".admin-library-filter-sheet__footer")).toContainText(/枚/);
      await expect(page.locator("[data-library-mobile-select]")).toBeVisible();
      await page.locator(".admin-library-view-menu > summary").click();
      await expect(page.locator("[data-library-mobile-arrange]")).toBeVisible();
    });
  });

  test("デスクトップではthumbSize(既定220px)がそのままminmaxに入る", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "PC表示が従来どおりであることの確認のため desktop のみで実行",
    );
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    const inline = await tileGrid(page).evaluate(
      (el) => (el as HTMLElement).style.gridTemplateColumns,
    );
    expect(inline).toContain("minmax(220px");
    // サムネイルサイズsliderもPCでは引き続き操作できる
    await page.locator(".admin-library-view-menu > summary").click();
    await expect(page.getByLabel("サムネイルサイズ")).toBeVisible();
  });
});
