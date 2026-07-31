import { expect, test, type Page, type Route } from "@playwright/test";

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

async function openTab(page: Page, tab: string) {
  await page.addInitScript((nextTab) => {
    localStorage.setItem("admin:tab", JSON.stringify(nextTab));
    localStorage.removeItem("admin:settingsDraft");
    sessionStorage.clear();
  }, tab);
  await page.goto("/admin");
  await page.waitForSelector(".admin-atelier", { timeout: 20_000 });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading..."),
    undefined,
    { timeout: 20_000 },
  );
}

test.describe("admin — Form layout", () => {
  test("Settingsは19節の目次・変更節・失敗節・保存時刻を対応させる", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCのForm目次で確認する");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTab(page, "settings");

    const layout = page.locator('[data-admin-form-layout="settings"]');
    const toc = layout.locator(".admin-form-toc");
    const links = toc.locator("[data-settings-section-link]");
    await expect(layout).toBeVisible();
    await expect(toc).toBeVisible();
    await expect(links).toHaveCount(19);

    // 本文は現在地の1節だけ。左の目次と同じ節名の一覧を本文へ二重に置かない。
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
    await expect(
      toc.locator('[data-settings-section-link="site-basics"]')
        .locator("[data-settings-section-changed]"),
    ).toHaveCount(1);
    await expect(page.locator("[data-settings-save-panel]")).toContainText(
      "未保存の変更 1件",
    );

    mocks.setFailSettingsSave(true);
    await page
      .locator("[data-settings-save-panel]")
      .getByRole("button", { name: "保存" })
      .click();
    await expect(page.locator("[data-settings-save-panel]")).toContainText(
      "保存に失敗しました",
    );
    await expect(basics).toHaveAttribute("data-settings-section-error", "true");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toBeFocused();

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

  test("1440pxと1024pxでForm本文幅と目次幅を守り、横にはみ出さない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCの2幅で確認する");

    await installMocks(page);
    for (const [width, expectedToc, maxBody] of [
      [1440, 196, 642],
      [1024, 184, 642],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await openTab(page, "settings");
      const measurements = await page
        .locator('[data-admin-form-layout="settings"]')
        .evaluate((root) => {
          const toc = root.querySelector(".admin-form-toc");
          const body = root.querySelector(".admin-settings-form-layout__body");
          return {
            toc: toc?.getBoundingClientRect().width ?? 0,
            body: body?.getBoundingClientRect().width ?? 0,
            overflow:
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          };
        });
      expect(Math.abs(measurements.toc - expectedToc)).toBeLessThanOrEqual(1);
      expect(measurements.body).toBeLessThanOrEqual(maxBody);
      expect(measurements.overflow).toBeLessThanOrEqual(1);
    }
  });

  test("gallerySeedはギャラリー配置の変更として数え、値復元と保存後に印を消す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCの目次で確認する");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTab(page, "settings");

    await page.locator('[data-settings-section-link="gallery-layout"]').click();
    const section = page.locator(
      '[data-settings-section="gallery-layout"]',
    );
    await expect(section).toBeVisible();
    const shuffle = section.getByRole("button", {
      name: "配置をシャッフル",
    });
    const tocMarker = page
      .locator('[data-settings-section-link="gallery-layout"]')
      .locator("[data-settings-section-changed]");
    const savePanel = page.locator("[data-settings-save-panel]");

    await page.evaluate(() => {
      Math.random = () => 0.5;
    });
    await shuffle.click();
    await expect(section).toHaveAttribute(
      "data-settings-section-changed",
      "true",
    );
    await expect(tocMarker).toHaveCount(1);
    await expect(savePanel).toContainText("未保存の変更 1件");
    await expect(savePanel).toContainText("ギャラリー配置");

    await page.evaluate(() => {
      Math.random = () => 0;
    });
    await shuffle.click();
    await expect(section).toHaveAttribute(
      "data-settings-section-changed",
      "false",
    );
    await expect(tocMarker).toHaveCount(0);
    await expect(savePanel).toContainText("未保存の変更はありません");

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
    await expect(tocMarker).toHaveCount(0);
    await expect(savePanel).toContainText(/に保存/);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("390pxは上部1行と全節シートを持ち、下部保存帯を維持する", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "スマホ幅で確認する");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openTab(page, "settings");

    const current = page.locator(".admin-settings-mobile-current");
    await expect(current).toBeVisible();
    await expect(page.locator(".admin-form-toc")).toBeHidden();

    const basics = page.locator('[data-settings-section="site-basics"]');
    await expect(basics).toBeVisible();
    const input = basics.locator("input[type='text']").first();
    await input.fill("スマホで変更");
    await expect(page.locator(".admin-floating-save-bar")).toBeVisible();

    await current.getByRole("button", { name: /切り替え/ }).click();
    const sheet = page.locator("[data-settings-mobile-section-list]");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".admin-settings-section-sheet__list > button"))
      .toHaveCount(19);
    await expect(sheet).toContainText("変更あり");
    await sheet.getByRole("button", { name: /Hero/ }).click();
    await expect(sheet).toHaveCount(0);
    await expect(
      page.locator('[data-settings-section="hero"] [data-settings-section-heading]'),
    ).toBeFocused();
    // 節を選ぶと本文がその節へ入れ替わり、上部1行の現在地も追随する。
    await expect(page.locator("[data-settings-section]")).toHaveCount(1);
    await expect(current).toContainText("Hero");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("390pxの節一覧にもgallerySeedの変更印を出す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "390pxで確認する");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openTab(page, "settings");

    await page
      .locator(".admin-settings-mobile-current")
      .getByRole("button", { name: /切り替え/ })
      .click();
    await page
      .locator("[data-settings-mobile-section-list]")
      .locator("button")
      .filter({ hasText: "ギャラリー配置" })
      .click();
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
    await current.getByRole("button", { name: /切り替え/ }).click();
    const sheet = page.locator("[data-settings-mobile-section-list]");
    const galleryRow = sheet
      .locator("button")
      .filter({ hasText: "ギャラリー配置" });
    await expect(galleryRow).toContainText("変更あり");

    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("19節すべてへ目次から到達し、本文には常に1節だけ出す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCの目次で全節を辿る");

    const mocks = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTab(page, "settings");

    const links = page.locator("[data-settings-section-link]");
    await expect(links).toHaveCount(19);
    const sectionIds = await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-settings-section-link")),
    );

    for (const sectionId of sectionIds) {
      await page.locator(`[data-settings-section-link="${sectionId}"]`).click();
      const sections = page.locator("[data-settings-section]");
      await expect(
        sections,
        `${sectionId} を選んだら本文はその節だけになる`,
      ).toHaveCount(1);
      await expect(sections).toHaveAttribute(
        "data-settings-section",
        sectionId!,
      );
      await expect(
        page.locator(`[data-settings-section-link="${sectionId}"]`),
      ).toHaveAttribute("aria-current", "location");
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

  test("390pxでは目次が本文を押し下げず、最初の入力欄が1画面に入る", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "390pxで確認する");

    await installMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openTab(page, "settings");

    const current = page.locator(".admin-settings-mobile-current");
    await expect(current).toBeVisible();
    const currentBox = await current.boundingBox();
    expect(currentBox?.height ?? 999, "上部の節表示は1行に収める").toBeLessThanOrEqual(
      56,
    );

    // 節名の一覧を本文の上へ積まない。上部1行とシートだけが節の切替器。
    await expect(page.locator(".admin-form-toc")).toBeHidden();
    await expect(page.locator("[data-settings-section]")).toHaveCount(1);

    const heading = page
      .locator("[data-settings-section] [data-settings-section-heading]")
      .first();
    await expect(heading).toBeVisible();

    // 目次が本文を押し下げていないことを結果で測る: スクロールせずに
    // 最初の入力欄まで届く。
    const firstField = page
      .locator("[data-settings-section] input, [data-settings-section] select")
      .first();
    await expect(firstField).toBeVisible();
    const fieldBox = await firstField.boundingBox();
    expect(
      (fieldBox?.y ?? 9999) + (fieldBox?.height ?? 0),
      "最初の入力欄が1画面目に収まる",
    ).toBeLessThanOrEqual(844);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Profile・Pricing・Serviceは目次なしのForm本文幅を使う", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCのForm幅で確認する");

    await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Pricing は一覧が主役なので list 幅、Profile / Service は入力なので form 幅。
    // どちらも「目次を持たない共通ページ枠」であることが要点。
    for (const tab of ["profile", "pricing", "service"]) {
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
