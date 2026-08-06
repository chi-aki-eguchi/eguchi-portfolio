import { test, expect } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

// 2026-07-31 の刷新で 30px の小さいボタン(`.ax-btn--small` / `.ax-status-toggle`)を
// 増やした。幅を狭めただけの Desktop Chrome では当たり判定の縮みを検出できないため、
// このスペックだけは本物のタッチ端末プロファイル(mobile-touch)で回す。
// 読み取り専用。保存・削除・追加は押さない。
const MIN_TAP = 40;

async function expectTouchTargets(page: import("@playwright/test").Page, selector: string) {
  const targets = page.locator(selector);
  const count = await targets.count();
  expect(count, `${selector} に検査対象がある`).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    if (!box) continue;
    const label =
      (await target.getAttribute("aria-label")) ??
      (await target.textContent())?.trim() ??
      `${selector}#${index}`;
    expect(box.width, `${label} の幅`).toBeGreaterThanOrEqual(MIN_TAP);
    expect(box.height, `${label} の高さ`).toBeGreaterThanOrEqual(MIN_TAP);
  }
}

test.describe("admin — タッチ端末の当たり判定", () => {
  test("一覧行の小さいボタンも指で押せる大きさになる", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-touch",
      "当たり判定は本物のタッチ端末プロファイルでだけ意味がある",
    );
    await loginAsAdmin(page);

    for (const tab of ["series", "pricing", "categories"]) {
      await gotoAdminTab(page, tab);
      const buttons = page.locator(
        ".ax-row .ax-btn, .ax-row .ax-status-toggle",
      );
      const count = await buttons.count();
      if (count === 0) continue;
      for (let i = 0; i < count; i += 1) {
        const box = await buttons.nth(i).boundingBox();
        if (!box) continue;
        const label =
          (await buttons.nth(i).getAttribute("aria-label")) ?? `${tab}#${i}`;
        expect(
          Math.min(box.width, box.height),
          `${label} の当たり判定が ${MIN_TAP}px 未満`,
        ).toBeGreaterThanOrEqual(MIN_TAP);
      }
    }
  });

  test("Libraryの作業・絞り込み・写真編集・選択操作が40px以上", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-touch", "mobile-touchのみ");
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    await expectTouchTargets(
      page,
      ".admin-library-workbar__row button, .admin-library-workbar__row input:visible, .admin-library-workbar__row summary",
    );
    await page.locator("[data-library-filters-toggle]").click();
    await expectTouchTargets(
      page,
      "[data-library-filter-sheet] button, [data-library-filter-sheet] select",
    );
    await page.locator("[data-library-filters-toggle]").click();

    await page.locator(".admin-photo-tile").first().locator("[data-library-photo-action]").click();
    await expectTouchTargets(
      page,
      "[data-library-inspector] button:visible, [data-library-inspector] input:visible, [data-library-inspector] select:visible, [data-library-inspector] textarea:visible",
    );
    await page.locator("[data-library-inspector-close]").click();

    await page.locator("[data-library-mobile-select]").click();
    await page.locator(".admin-photo-tile").first().locator("[data-library-photo-action]").click();
    await expectTouchTargets(page, "[data-library-selection-toolbar] button:visible, [data-library-selection-toolbar] summary");
  });
});
