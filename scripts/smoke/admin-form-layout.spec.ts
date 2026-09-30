import { backToSiteList, chooseSettingsSection, SETTINGS_SECTION_COUNT, storeAdminTab } from "./helpers";
import { expect, test, type Page, type Route } from "./fixtures.ts";
import { BOOK_DESIGN_ENABLED } from "./site-design.ts";

const SETTINGS = {
  setupCompleted: "true",
  siteName: "Form layout fixture",
  siteNameEn: "Form layout fixture",
  siteDescription: "人工データだけで確認する設定画面",
  gallerySortOrder: "manual",
  gallerySeed: "1",
  servicePageMode: "off",
};

async function installMocks(page: Page) {
  const writes: string[] = [];
  const unknownWrites: string[] = [];
  let failSettingsSave = false;
  const currentSettings = { ...SETTINGS };

  const json = (value: unknown) => (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

  // 未知のGETは空の人工データで返し、モック外の書き込みは止める。
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      unknownWrites.push(`${request.method()} ${request.url()}`);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "unmocked write blocked" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route("**/api/admin/photos/trash**", json({ photos: [] }));
  await page.route("**/api/photos**", json({ photos: [] }));
  await page.route("**/api/categories**", json({ categories: [] }));
  await page.route("**/api/series**", json({ series: [] }));
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  await page.route("**/api/admin/pricing**", json({ plans: [] }));
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentSettings),
    }),
  );
  await page.route("**/api/admin/settings**", async (route) => {
    writes.push(`${route.request().method()} ${route.request().url()}`);
    const submitted = route.request().postDataJSON() as Record<string, string>;
    if (!failSettingsSave) Object.assign(currentSettings, submitted);
    await route.fulfill({
      status: failSettingsSave ? 500 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        failSettingsSave
          ? { error: "fixture save failure" }
          : { ok: true, ignoredKeys: [] },
      ),
    });
  });

  return {
    writes,
    unknownWrites,
    setFailSettingsSave(value: boolean) {
      failSettingsSave = value;
    },
  };
}

// 管理画面はいつも「写真・シリーズ・サイト」の器で、「サイト」は公開サイトを見ながら
// 直す画面（2026-09-29）。以前のタブ名を、サイトの画面で開く部分へ読み替える
// （settings は以前の既定の節「トップの写真の見せ方」）。
async function openTab(page: Page, tab: string) {
  await page.addInitScript(() => {
    // プレビュー（同じオリジンの iframe）の読み込みでは消さない。下書きが消える。
    if (window.top !== window) return;
    localStorage.removeItem("admin:settingsDraft");
    sessionStorage.clear();
  });
  await page.addInitScript(storeAdminTab, tab);
  await page.goto("/admin");
  await page.waitForSelector(".admin-atelier", { timeout: 20_000 });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading..."),
    undefined,
    { timeout: 20_000 },
  );
}

// 設定の節を開くのは右の一覧（部分の行、または「探す」で出る節の行）。以前の目次の
// 「変更した節の印」は、同じ節を開く行に付く。
async function changedMarker(page: Page, sectionId: string) {
  await backToSiteList(page);
  await page.locator(".se-search input").fill(sectionId);
  return page.locator(`.se-parts [data-site-sections~="${sectionId}"] [data-settings-section-changed]`);
}

// 34節。台帳（SETTINGS_SECTION_KEYS）と同じ。増減したら SETTINGS_SECTION_COUNT と揃える。
const SECTION_IDS = [
  "site-basics", "contact", "contact-words", "portfolio-kit", "hero", "navigation", "spacing", "reveal",
  "gallery-layout", "top-works", "series-cards", "series-layout", "series-strip", "order", "mood",
  "page-layout", "home", "statement-text", "statement", "viewer", "about", "about-layout", "contact-layout",
  "note", "print", "cta", "theme", "fonts", "name", "headings", "body", "footer", "site-copy", "presets",
];

test.describe("admin — Form layout", () => {
  test("構図の選択が明暗両方で見分けられ、キーボードで変更・取り消しできる", async ({ page }) => {
    const mocks = await installMocks(page);
    for (const surface of ["light", "dark"]) {
      await page.addInitScript(next => localStorage.setItem("admin-surface-preference", next), surface);
      await openTab(page, "settings");
      const single = page.getByRole("button", { name: /^1枚絵/ });
      await single.focus();
      await page.keyboard.press("Enter");
      await expect(single).toHaveAttribute("aria-pressed", "true");
      const paint = await single.evaluate(element => {
        const selected = getComputedStyle(element);
        const unselected = getComputedStyle(document.querySelector('.studio-option[aria-pressed="false"]')!);
        return { background: selected.backgroundColor, otherBackground: unselected.backgroundColor, shadow: selected.boxShadow };
      });
      expect(paint.background).not.toBe(paint.otherBackground);
      expect(paint.shadow).not.toBe("none");
      await page.keyboard.press("ControlOrMeta+z");
      await expect(single).toHaveAttribute("aria-pressed", "false");
    }
    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("Settingsは変更した所・失敗した節・保存時刻を対応させる", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで確認する");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTab(page, "settings");
    await expect(page.locator('[data-admin-form-layout="settings"]')).toBeVisible();

    // 本文は開いた1節だけ。節名の一覧を本文へ二重に置かない。
    await chooseSettingsSection(page, "site-basics");
    const basics = page.locator('[data-settings-section="site-basics"]');
    await expect(basics).toBeVisible();
    await expect(page.locator("[data-settings-section]")).toHaveCount(1);
    await expect(page.locator(".admin-plain-section-trigger")).toHaveCount(0);
    const input = basics.locator("input[type='text']").first();
    const original = await input.inputValue();
    await input.fill(`${original} changed`);

    await expect(basics).toHaveAttribute(
      "data-settings-section-changed",
      "true",
    );
    await expect(page.locator("[data-settings-save-panel]")).toContainText(
      "未保存の変更 1件",
    );
    // 一覧へ戻ると、同じ節を開く行に印が付いている。開き直しても下書きは残る。
    await expect(await changedMarker(page, "site-basics")).toHaveCount(1);
    await chooseSettingsSection(page, "site-basics");
    await expect(input).toHaveValue(`${original} changed`);

    mocks.setFailSettingsSave(true);
    await page
      .locator("[data-settings-save-panel]")
      .getByRole("button", { name: "保存" })
      .click();
    await expect(page.locator("[data-settings-save-panel]")).toContainText(
      "保存に失敗しました",
    );
    await expect(basics).toHaveAttribute("data-settings-section-error", "true");
    // 失敗した節の最初の入力欄へ移る（連絡先と検索の先頭は、検索に出る説明）。
    const errorField = basics.locator("[data-settings-save-error-field]");
    await expect(errorField).toHaveAttribute("aria-invalid", "true");
    await expect(errorField).toBeFocused();

    mocks.setFailSettingsSave(false);
    await page
      .locator("[data-settings-save-panel]")
      .getByRole("button", { name: "保存" })
      .click();
    await expect
      .poll(() => mocks.writes.length, {
        message: "失敗後の再保存要求がモックへ届く",
      })
      .toBe(2);
    await expect(page.locator("[data-settings-save-panel]")).toContainText(
      /に保存/,
    );
    expect(mocks.writes).toHaveLength(2);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("1440pxと1024pxでプレビューと右の欄の幅を守り、横にはみ出さない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCの2幅で確認する");

    await installMocks(page);
    // 数字で縛ると器の幅を変えるたびに落ちるので、「右の欄が読める幅・
    // プレビューが主役・はみ出さない」を測る。
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await openTab(page, "settings");
      await expect(page.locator(".studio-preview-frame")).toBeVisible();
      await expect(page.locator(".admin-settings-workspace__form")).toBeVisible();
      const measurements = await page.evaluate(() => {
        const form = document.querySelector(".admin-settings-workspace__form");
        const preview = document.querySelector(".studio-preview-frame");
        return {
          form: form?.getBoundingClientRect().width ?? 0,
          preview: preview?.getBoundingClientRect().width ?? 0,
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        };
      });
      expect(measurements.form, `${width}px: 右の欄が細すぎる`).toBeGreaterThanOrEqual(320);
      expect(measurements.form, `${width}px: 右の欄が広すぎる`).toBeLessThanOrEqual(440);
      expect(measurements.preview, `${width}px: プレビューが右の欄より小さい`).toBeGreaterThan(measurements.form);
      expect(measurements.overflow).toBeLessThanOrEqual(1);
    }
  });

  test("gallerySeedはギャラリー配置の変更として数え、値復元と保存後に印を消す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで確認する");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTab(page, "settings");

    await chooseSettingsSection(page, "gallery-layout");
    const section = page.locator(
      '[data-settings-section="gallery-layout"]',
    );
    await expect(section).toBeVisible();
    const shuffle = section.getByRole("button", {
      name: "配置をシャッフル",
    });
    const savePanel = page.locator("[data-settings-save-panel]");

    await page.evaluate(() => {
      Math.random = () => 0.5;
    });
    await shuffle.click();
    await expect(section).toHaveAttribute(
      "data-settings-section-changed",
      "true",
    );
    await expect(savePanel).toContainText("未保存の変更 1件");
    await expect(savePanel).toContainText("写真の並べ方");
    await expect(await changedMarker(page, "gallery-layout")).toHaveCount(1);
    await chooseSettingsSection(page, "gallery-layout");

    await page.evaluate(() => {
      Math.random = () => 0;
    });
    await shuffle.click();
    await expect(section).toHaveAttribute(
      "data-settings-section-changed",
      "false",
    );
    // 2026-08-27: 「未保存の変更はありません」は出さないことにした。
    // 何も無いことをわざわざ言わない。空になることで同じ状態を示す。
    await expect(savePanel).toHaveText("");
    await expect(await changedMarker(page, "gallery-layout")).toHaveCount(0);
    await chooseSettingsSection(page, "gallery-layout");

    await page.evaluate(() => {
      Math.random = () => 0.5;
    });
    await shuffle.click();
    await savePanel.getByRole("button", { name: "保存" }).click();
    await expect
      .poll(() => mocks.writes.length, {
        message: "gallerySeedの保存要求がモックへ届く",
      })
      .toBe(1);
    await expect(section).toHaveAttribute(
      "data-settings-section-changed",
      "false",
    );
    await expect(savePanel).toContainText(/に保存/);
    await expect(await changedMarker(page, "gallery-layout")).toHaveCount(0);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("390pxは一覧と中身を1画面ずつ出し、下部保存帯と変更印を保つ", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "スマホ幅で確認する");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openTab(page, "settings");

    const current = page.locator(".admin-settings-mobile-current");
    await expect(current).toBeVisible();
    await expect(page.locator(".admin-form-toc")).toBeHidden();
    // 設定の中の「設定項目」一覧は出さない（右の一覧と2つ目の一覧が重なる）。
    await expect(current.getByRole("button", { name: /設定項目/ })).toBeHidden();

    await chooseSettingsSection(page, "site-basics");
    const basics = page.locator('[data-settings-section="site-basics"]');
    await expect(basics).toBeVisible();
    const input = basics.locator("input[type='text']").first();
    await input.fill("スマホで変更");
    await expect(page.locator("[data-settings-save-panel]")).toBeVisible();

    // 一覧へ戻ると、変更した節を開く行に印が付いている。別の節へ移っても下書きは残る。
    await expect(await changedMarker(page, "site-basics")).toHaveCount(1);
    await chooseSettingsSection(page, "hero");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.locator("[data-settings-section]")).toHaveCount(1);
    await expect(page.locator('[data-settings-section="hero"]')).toBeVisible();
    await expect(page.locator(".se-part-head__back")).toBeVisible();
    await expect(page.locator("[data-settings-save-panel]")).toContainText("未保存の変更 1件");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("390pxの一覧にもgallerySeedの変更印を出す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "390pxで確認する");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openTab(page, "settings");

    await chooseSettingsSection(page, "gallery-layout");
    const section = page.locator(
      '[data-settings-section="gallery-layout"]',
    );
    await expect(section).toBeVisible();
    await page.evaluate(() => {
      Math.random = () => 0.5;
    });
    await section
      .getByRole("button", { name: "配置をシャッフル" })
      .click();

    const current = page.locator(".admin-settings-mobile-current");
    await expect(
      current.locator(".admin-form-toc__dot--changed"),
    ).toHaveCount(1);
    await expect(await changedMarker(page, "gallery-layout")).toHaveCount(1);

    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("全節へ右の一覧から到達し、本文には開いた部分の節だけを出す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCで全節を辿る");
    test.setTimeout(90_000);

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTab(page, "settings");
    expect(SECTION_IDS).toHaveLength(SETTINGS_SECTION_COUNT);

    // 写真中心の骨格を止めている間（2026-09-30〜）、骨格の切り替えと写真中心だけの節は
    // 管理画面のどこからも出さない。
    const reachable = BOOK_DESIGN_ENABLED
      ? SECTION_IDS
      : SECTION_IDS.filter((id) => id !== "page-layout" && id !== "home");
    for (const sectionId of reachable) {
      await chooseSettingsSection(page, sectionId);
      // 部分によっては2つの節を並べる（作家の言葉＝文と位置、About＝文章と作家の言葉）。
      const sections = page.locator("[data-settings-section]");
      await expect(page.locator(`[data-settings-section="${sectionId}"]`)).toBeVisible();
      expect(await sections.count(), `${sectionId} を選んだら、その部分の節だけになる`).toBeLessThanOrEqual(2);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `${sectionId} で横にはみ出さない`).toBeLessThanOrEqual(1);
    }

    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("390pxでは一覧が本文を押し下げず、最初の設定操作が1画面に入る", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "390pxで確認する");

    await installMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openTab(page, "settings");

    const current = page.locator(".admin-settings-mobile-current");
    await expect(current).toBeVisible();
    const currentBox = await current.boundingBox();
    expect(currentBox?.height ?? 999, "上部の切り替えは1行に収める").toBeLessThanOrEqual(
      56,
    );

    // 節名の一覧を本文の上へ積まない。
    await expect(page.locator(".admin-form-toc")).toBeHidden();
    await expect(page.locator("[data-settings-section]")).toHaveCount(1);

    // 一覧が本文を押し下げていないことを結果で測る: スクロールせずに
    // 最初の設定操作まで届く。構図は写真付きの選択ボタンで編集する。
    const firstField = page
      .locator("[data-settings-section] .studio-option, [data-settings-section] input, [data-settings-section] select")
      .first();
    await expect(firstField).toBeVisible();
    const fieldBox = await firstField.boundingBox();
    expect(
      (fieldBox?.y ?? 9999) + (fieldBox?.height ?? 0),
      "最初の設定操作が1画面目に収まる",
    ).toBeLessThanOrEqual(844);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Pricing・Serviceは目次なしのForm本文幅を使う", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCのForm幅で確認する");

    await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Pricing は一覧が主役なので list 幅、Service は入力なので form 幅。
    // どちらも「目次を持たない共通ページ枠」であることが要点。About の文章は
    // 2026-09-30 からサイトの画面の設定（プレビューを見ながら直す）なので含めない。
    for (const tab of ["pricing", "service"]) {
      await openTab(page, tab);
      await expect(page.locator(".admin-form-toc")).toHaveCount(0);
      const kind = await page
        .locator("[data-admin-page-shell]")
        .getAttribute("data-admin-page-shell");
      expect(["form", "list"], `${tab} は共通ページ枠の用途幅を使う`).toContain(
        kind,
      );
      const shell = page.locator("[data-admin-page-shell] > div");
      await expect(shell).toHaveCount(1);
      const shellWidth = (await shell.boundingBox())?.width ?? 9999;
      expect(shellWidth).toBeLessThanOrEqual(900);
      // 上限だけだと、極端に細くても成功してしまう。
      expect(shellWidth, `${tab} の本文が細すぎる`).toBeGreaterThanOrEqual(560);
    }
  });
});
