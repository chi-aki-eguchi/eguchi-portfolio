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
  await twoColumns.click();
  await expect(twoColumns).toHaveAttribute("aria-pressed", "true");

  // 回帰(Claude review P1): 並べ替えボタンを触っただけではスクロール扱いに
  // しない。touchstartでボタンが140ms消えると、タッチ操作が点滅して見える。
  const moveButton = tiles.nth(0).getByRole("button", { name: "後へ移動" });
  if ((await moveButton.count()) > 0) {
    await moveButton.evaluate((button) => {
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
    await expect(moveButton).toBeVisible();
  }

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

  // 3列は写真を一覧する密度優先モード。40px角の並べ替えボタンは写真を
  // 覆うため隠し、2列へ戻すと再び操作できる。
  await expect(
    tiles.nth(0).getByRole("button", { name: "前へ移動" }),
  ).toHaveCount(0);
  await expect(
    tiles.nth(0).getByRole("button", { name: "後へ移動" }),
  ).toHaveCount(0);

  // カード上の回転/移動ボタンがタイルからはみ出さない
  // (hasTouch=pointer:coarse なので admin-tap-sm は40px角に拡大された状態)
  const tileBox = box1!;
  for (const label of ["右へ90度回転", "前へ移動", "後へ移動"]) {
    const btn = tiles.nth(0).getByRole("button", { name: label });
    if ((await btn.count()) === 0) continue; // reorderロック中は移動ボタン非表示
    const b = await btn.boundingBox();
    if (!b) continue;
    expect(b.x + b.width).toBeLessThanOrEqual(tileBox.x + tileBox.width + 1);
    expect(b.x).toBeGreaterThanOrEqual(tileBox.x - 1);
  }
  // coarse では ⇤⇥(先頭/末尾)は40px×4個で167pxカードに収まらないため
  // 非表示、前/次のみで並び替えは維持される
  if (
    (await tiles.nth(0).getByRole("button", { name: "前へ移動" }).count()) > 0
  ) {
    await expect(
      tiles.nth(0).getByRole("button", { name: "先頭へ移動" }),
    ).toHaveCount(0);
  }

  // タイルタップ → Inspector(モバイルはドロワー)が開く。編集していないので
  // × は即閉じ(確認ダイアログなし・非書き込み)。
  await tiles.nth(0).locator("button").first().click();
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
    await expect(page.getByLabel("サムネイルサイズ")).toBeVisible();
  });
});
