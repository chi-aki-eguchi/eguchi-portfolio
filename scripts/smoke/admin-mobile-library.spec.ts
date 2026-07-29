import { test, expect, type Page } from "@playwright/test";
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
  await expect(page.getByText("Edit Photo")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Edit Photo")).toBeHidden();
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
