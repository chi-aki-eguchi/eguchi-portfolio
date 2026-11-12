import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";
import { loginAsAdmin } from "./helpers";

/**
 * 「サイト」の並びは公開サイトのページそのもの（2026-11-12、spec admin-redesign-20261112 §2.1・§2.2）。
 *
 * 新しい構成（siteDesign = develop）のサイトでは、ページが トップ／Portrait／Works／Info／展示／
 * 東京プラン／名刺のQR、まとまりが 共通／見た目／そのほか。スマホは横に送る帯をやめ、
 * 「いまのページ ▾」から下に出る欄で選ぶ（横に隠れる入口を作らない）。
 *
 * 読み取りだけ。設定の読み込みを差し替えて構成を新しい物にし（持ち主のサイトとして展示・東京
 * プランも出す）、保存は押さない。写真を選ぶ画面へ行って戻るだけ。
 */

const PAGES = ["トップ", "Portrait", "Works", "Info", "展示", "東京プラン", "名刺のQR"];
const GROUPS = ["共通", "見た目", "そのほか"];

async function openDevelopSite(page: Page, api: SmokeApi) {
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  const develop = { ...settings, siteDesign: "develop", siteUrl: "https://akieguchi.com", setupCompleted: "true" };
  await page.route("**/api/settings**", (route) =>
    route.request().method() !== "GET"
      ? route.fallback()
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(develop) }),
  );
  await page.route("**/api/admin/settings**", (route) =>
    route.request().method() !== "GET"
      ? route.fallback()
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(develop) }),
  );
  await loginAsAdmin(page);
  await page.evaluate(() => {
    localStorage.setItem("admin:site:mode", JSON.stringify("page"));
    localStorage.setItem("admin:site:page", JSON.stringify("top"));
    localStorage.setItem("admin:site:part", "null");
  });
  await page.goto("/admin#site/page/top");
  await expect(page.locator('.se-parts [data-site-part="top-style"]')).toBeVisible({ timeout: 20_000 });
}

test.describe("admin — サイトの並び（新しい構成）", () => {
  test("スマホ: 1行の「いまのページ ▾」から全部のページへ行け、写真を選ぶ画面から戻れる", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "スマホ幅の並び");
    test.setTimeout(90_000);
    await openDevelopSite(page, api);

    // 帯は1行で、横にはみ出す入口が無い。
    const picker = page.locator(".se-pagepick__button");
    await expect(picker).toBeVisible();
    await expect(picker).toContainText("トップ");
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll(".se-bar *")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5);
      }).length,
    );
    expect(clipped).toBe(0);
    await expect(page.locator(".se-bar__view .admin-settings-mobile-current__view-switch")).toBeVisible();

    // 押すと全部のページと 共通・見た目・そのほか が下から出る。どの行も 48px 以上、下の入口に重ならない。
    await picker.click();
    const sheet = page.locator(".se-pagepick__sheet");
    await expect(sheet).toBeVisible();
    // 下から出る動き（0.2秒）が終わってから測る。
    await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const rows = sheet.locator("[data-site-pick]");
    expect(await rows.allTextContents()).toEqual([...PAGES, ...GROUPS]);
    for (const height of await rows.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
      expect(height).toBeGreaterThanOrEqual(48);
    }
    const geometry = await page.evaluate(() => ({
      sheetBottom: document.querySelector(".se-pagepick__sheet")!.getBoundingClientRect().bottom,
      tabsTop: document.querySelector(".admin-book__tabs")!.getBoundingClientRect().top,
    }));
    expect(geometry.sheetBottom).toBeLessThanOrEqual(geometry.tabsTop + 0.5);
    await expect(sheet.locator('[data-site-pick="top"]')).toHaveAttribute("aria-current", "true");

    // Escape で閉じ、押したボタンへ戻る。
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(picker).toBeFocused();

    // Portrait へ。写真を選ぶ行は /admin/pages の Portrait のタブを開き、戻ると Portrait に戻る。
    await picker.click();
    await page.locator('[data-site-pick="portrait"]').click();
    await expect(picker).toContainText("Portrait");
    expect(
      await page.locator(".se-parts [data-site-part]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.sitePart)),
    ).toEqual(["portrait-photos", "gallery", "cta-ref"]);
    await page.locator('[data-site-part="portrait-photos"]').click();
    await expect(page).toHaveURL(/\/admin\/pages\?tab=portrait/);
    await expect(page.locator('[data-pp-tab="portrait"]')).toHaveAttribute("aria-selected", "true", { timeout: 20_000 });
    await page.locator(".pp-back").first().click();
    await expect(page).toHaveURL(/\/admin#site\/page\/portrait$/);
    await expect(page.locator(".se-pagepick__button")).toContainText("Portrait", { timeout: 20_000 });

    // 欄の名前でも探せる。Instagram の住所は Info の「自己紹介と SNS」だけ。
    await page.locator(".se-search input").fill("Instagram");
    await expect(page.locator(".se-parts [data-site-part]").first()).toHaveAttribute("data-site-part", "about");
  });

  test("PC: 全部の入口が帯に並び、切れない", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PC幅の並び");
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      await openDevelopSite(page, api);
      await expect(page.locator(".se-pagepick__button")).toBeHidden();
      expect(await page.locator(".se-bar [data-site-page]").allTextContents()).toEqual(PAGES);
      expect((await page.locator(".se-bar [data-site-mode]").allTextContents()).map((t) => t.trim())).toEqual(GROUPS);
      const outside = await page.evaluate(() =>
        [...document.querySelectorAll(".se-bar [data-site-page], .se-bar [data-site-mode]")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > document.documentElement.clientWidth + 0.5 || r.left < 0;
        }).length,
      );
      expect(outside, `${width}px`).toBe(0);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
});
