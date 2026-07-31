import { test, expect } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

// 2026-07-31 の刷新で 30px の小さいボタン(`.ax-btn--small` / `.ax-status-toggle`)を
// 増やした。幅を狭めただけの Desktop Chrome では当たり判定の縮みを検出できないため、
// このスペックだけは本物のタッチ端末プロファイル(mobile-touch)で回す。
// 読み取り専用。保存・削除・追加は押さない。
const MIN_TAP = 40;

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
});
