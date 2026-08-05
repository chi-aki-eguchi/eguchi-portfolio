import { expect, test } from "@playwright/test";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

// 2026-08-05: iOS Safari は 16px 未満の入力欄にフォーカスすると画面ごと拡大し、
// 自動では戻さない。admin の入力欄は 12〜14px だったので、スマホでは項目を1つ
// 触るたびにピンチで戻す必要があった（設定20欄・撮影依頼100欄）。
// 直したのは `@media (pointer: coarse)` の1ルールなので、タッチのプロジェクトで
// 見張らないと意味がない。
test.describe("admin — スマホで入力欄に触っても拡大しない", () => {
  test("すべてのタブで、文字を打つ入力欄が16px以上", async ({ page }, testInfo) => {
    test.skip(
      !/mobile-touch/.test(testInfo.project.name),
      "pointer: coarse のプロジェクトでのみ意味がある",
    );
    await loginAsAdmin(page);
    const offenders: string[] = [];
    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      const small = await page.evaluate((tabName) => {
        const notTypeable = ["range", "checkbox", "radio", "color", "file", "submit", "button", "hidden"];
        return [...document.querySelectorAll("input, textarea, select")]
          .filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") return false;
            if (notTypeable.includes((el as HTMLInputElement).type)) return false;
            return parseFloat(cs.fontSize) < 16;
          })
          .map(
            (el) =>
              `${tabName}: ${el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.tagName} @ ${getComputedStyle(el).fontSize}`,
          );
      }, tab);
      offenders.push(...small);
    }
    expect(offenders, "16px未満の入力欄はiOSで画面を拡大させる").toEqual([]);
  });
});
