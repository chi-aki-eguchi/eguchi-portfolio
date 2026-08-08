import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

function firstFamily(fontList: string): string {
  return fontList.split(",")[0]?.trim().replace(/['"]/g, "") ?? "";
}

/**
 * 管理画面の書体は、公開サイトの書体設定から**切り離されている**
 * （2026-08-07 オーナー判断・案(a)。commit 4c38ec1）。
 *
 * この spec は以前、逆の契約（公開サイトの書体に揃う）を検査していた。撤回
 * された契約をそのまま検査し続けていたため、2026-08-08 の smoke で2件落ちて
 * いた。判断そのものを守る形へ書き換える。
 *
 * 守りたいのは1点。**オーナーが公開サイトの書体をどう変えても、管理画面が
 * 読みにくくならないこと。**
 */
test.describe("admin — 書体は公開サイト設定から独立している", () => {
  test("サイドバーは admin 専用の書体変数を使う", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.waitForTimeout(500);

    // 変数は :root ではなく `.admin-atelier` に置かれている（公開サイトの
    // document へ漏らさないため）。読み取り先を間違えると空文字が返る。
    const vars = await page.evaluate(() => {
      const host = document.querySelector(".admin-atelier");
      if (!host) return { adminTitle: "", adminUi: "" };
      const cs = getComputedStyle(host);
      return {
        adminTitle: cs.getPropertyValue("--admin-font-title"),
        adminUi: cs.getPropertyValue("--admin-font-ui"),
      };
    });
    // admin 専用の変数が定義されていること（これが無ければ切り離せていない）
    expect(firstFamily(vars.adminTitle)).not.toBe("");
    expect(firstFamily(vars.adminUi)).not.toBe("");

    const titleFont = await page
      .locator(".admin-sidebar__title")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    const tabFont = await page
      .locator(".admin-sidebar__tab span")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);

    expect(titleFont).toContain(firstFamily(vars.adminTitle));
    expect(tabFont).toContain(firstFamily(vars.adminUi));
  });

  test("公開サイトの書体変数が変わっても管理画面は動かない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.waitForTimeout(500);

    const read = () =>
      page.evaluate(() => {
        const q = (sel: string) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).fontFamily : "";
        };
        return {
          title: q(".admin-sidebar__title"),
          tab: q(".admin-sidebar__tab span"),
        };
      });

    const before = await read();
    // 公開サイト側の書体変数だけを、目に見えて違うものへ差し替える。
    // 保存はしない（本番DBに触れない）。この document 上の変数を変えるだけ。
    await page.evaluate(() => {
      document.documentElement.style.setProperty(
        "--font-ja",
        '"Comic Sans MS", cursive',
      );
      document.documentElement.style.setProperty(
        "--font-en",
        '"Comic Sans MS", cursive',
      );
    });
    await page.waitForTimeout(200);
    const after = await read();

    expect(after.title).toBe(before.title);
    expect(after.tab).toBe(before.tab);
    expect(after.title).not.toContain("Comic Sans MS");
    expect(after.tab).not.toContain("Comic Sans MS");
  });
});
