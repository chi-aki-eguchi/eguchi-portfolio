import { chooseSettingsSection } from "./helpers";
import { expect, test, type Page, type Route } from "@playwright/test";
import { SETTINGS_SECTION_COUNT } from "./helpers";

// Settings のプレビュー Workspace（Phase 1A）。実測で確定した P1〜P6 の回帰を
// 止めるための検査。仕様は docs/specs/admin-phase1-settings-preview.md §12-1。
// 本番と同じDBへ繋がないよう、APIはすべて人工データで差し替える。

const SETTINGS = {
  // A retired display value may still exist in saved data. It must never
  // bypass the owner's layout, color, and typography settings again.
  publicExperience: "photo-app",
  setupCompleted: "true",
  siteName: "Preview workspace fixture",
  siteNameEn: "Preview workspace fixture",
  siteDescription: "人工データだけで確認するプレビュー",
  gallerySortOrder: "manual",
  gallerySeed: "1",
  servicePageMode: "off",
};

async function installMocks(page: Page, persist = false) {
  const savedPayloads: Record<string, string>[] = [];
  const writes: string[] = [];
  const unknownWrites: string[] = [];
  const currentSettings = { ...SETTINGS };

  const json = (value: unknown) => (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

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
    const payload = route.request().postDataJSON() as Record<string, string>;
    savedPayloads.push(payload);
    if (persist) Object.assign(currentSettings, payload);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, ignoredKeys: [] }),
    });
  });

  return { writes, unknownWrites, savedPayloads };
}

async function openSettings(page: Page) {
  // 初回の読み込みだけ状態を掃除する。reload() でも走らせると、まさに
  // 検査したい「保存された幅」を毎回消してしまう。
  await page.addInitScript(() => {
    if (!localStorage.getItem("admin:smokeFixtureReady")) {
      localStorage.setItem("admin:smokeFixtureReady", "1");
      localStorage.removeItem("admin:settingsDraft");
      localStorage.removeItem("admin:showPreview");
      localStorage.removeItem("admin:settingsPreviewWidth");
      localStorage.setItem("admin:previewDevice", JSON.stringify("desktop"));
      sessionStorage.clear();
    }
    localStorage.setItem("admin:tab", JSON.stringify("settings"));
  });
  await page.goto("/admin");
  await page.waitForSelector(".admin-atelier", { timeout: 20_000 });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading..."),
    undefined,
    { timeout: 20_000 },
  );
}

// 2026-08-27: プレビューは既定で開くようになった。ここが欲しいのは
// 「開いた状態」であって「開くボタンを押すこと」ではないので、
// 既に開いていれば何もしない。既定値を変えても壊れない形にする。
async function openPreview(page: Page) {
  const open = page.getByRole("button", { name: "プレビューを開く" });
  if ((await open.count()) > 0) await open.click();
  const preview = page.locator("[data-settings-preview]");
  // 狭い幅は「編集↔プレビュー」の切り替え。既定で開いていても見ているのは
  // 編集側なので、切り替えを押して初めてプレビューが出る。
  if (!(await preview.isVisible())) {
    const toPreview = page.getByRole("button", {
      name: "プレビュー",
      exact: true,
    });
    if ((await toPreview.count()) > 0) await toPreview.click();
  }
  await expect(preview).toBeVisible();
}

const documentOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe("admin — サイト編集のプレビューと下書き", () => {
  test("常設の項目一覧から全節へ到達でき、編集中に現在地が戻らない", async ({page}, info) => {
    test.skip(info.project.name !== "desktop", "desktop navigation");
    const mocks = await installMocks(page);
    await openSettings(page);
    const links = page.locator(".studio-editor-outline [data-settings-section-link]");
    await expect(links).toHaveCount(SETTINGS_SECTION_COUNT);
    for (const id of ["site-basics", "fonts", "gallery-layout", "hero"]) {
      await chooseSettingsSection(page, id);
      await expect(page.locator("[data-settings-section]")).toHaveAttribute("data-settings-section", id);
    }
    await page.getByRole("combobox", {name: "登場する速さ", exact: true}).selectOption({label: "すばやく"});
    await expect(page.locator("[data-settings-section]")).toHaveAttribute("data-settings-section", "hero");
    expect(mocks.unknownWrites).toEqual([]);
    expect(mocks.writes).toEqual([]);
  });

  test("欄の幅に関係なく実際のPC・スマホ寸法を保ち、縦横を一緒に縮小する", async ({page}, info) => {
    test.skip(info.project.name !== "desktop", "desktop dimensions");
    await installMocks(page);
    await openSettings(page);
    const iframe = page.locator('iframe[title="Site Preview"]');
    for (const width of [1600, 1440, 1024, 768]) {
      await page.setViewportSize({width, height: 900});
      await openPreview(page);
      await expect.poll(() => iframe.evaluate((el: HTMLIFrameElement) => [el.contentWindow!.innerWidth, el.contentWindow!.innerHeight])).toEqual([1440, 900]);
      const rect = (await iframe.boundingBox())!;
      expect(rect.width / rect.height).toBeCloseTo(1440 / 900, 2);
      expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({width: 1440, height: 900});
    await page.getByRole("button", {name: "スマホ幅", exact: true}).click();
    await expect.poll(() => iframe.evaluate((el: HTMLIFrameElement) => [el.contentWindow!.innerWidth, el.contentWindow!.innerHeight])).toEqual([390, 844]);
    const rect = (await iframe.boundingBox())!;
    expect(rect.width / rect.height).toBeCloseTo(390 / 844, 2);
  });

  test("比較したいウィンドウの寸法を入力し、公開リンクは確認中のページを開く", async ({page}, info) => {
    test.skip(info.project.name !== "desktop", "desktop custom dimensions");
    await installMocks(page);
    await openSettings(page);
    await page.locator(".studio-preview-dimensions summary").click();
    const width = page.getByRole("spinbutton", {name: "プレビューの幅"});
    await width.fill("1080");
    await width.press("Tab");
    const height = page.getByRole("spinbutton", {name: "プレビューの高さ"});
    await height.fill("720");
    await height.press("Tab");
    const iframe = page.locator('iframe[title="Site Preview"]');
    await expect.poll(() => iframe.evaluate((el: HTMLIFrameElement) => [el.contentWindow!.innerWidth, el.contentWindow!.innerHeight])).toEqual([1080, 720]);
    await page.locator(".studio-preview-dimensions summary").click();
    await page.getByRole("combobox", {name: "確認するページ"}).selectOption("/contact");
    await expect(page.locator(".studio-preview-status a")).toHaveAttribute("href", "/contact");
    await expect(page.locator(".studio-preview-status a")).toHaveAttribute("rel", "noopener");
  });

  test("下書きと保存済みを切り替え、元に戻す・やり直す・保存が使える", async ({page}, info) => {
    test.skip(info.project.name !== "desktop", "desktop editing");
    const mocks = await installMocks(page, true);
    await openSettings(page);
    await chooseSettingsSection(page, "site-basics");
    const input = page.locator('[data-settings-section] input[type="text"]').first();
    await input.fill("Undo draft");
    await page.getByRole("button", {name: "設定を元に戻す", exact: true}).click();
    await expect(input).toHaveValue(SETTINGS.siteName);
    await page.getByRole("button", {name: "設定をやり直す", exact: true}).click();
    await expect(input).toHaveValue("Undo draft");
    const frame = page.frameLocator('iframe[title="Site Preview"]');
    await expect(frame.locator('[data-hero-name-part="primary"]')).toContainText("Undo draft");
    await page.getByRole("combobox", {name: "プレビューの内容"}).selectOption("saved");
    await expect(frame.locator('[data-hero-name-part="primary"]')).toContainText(SETTINGS.siteName);
    await expect(input).toHaveValue("Undo draft");
    await page.getByRole("combobox", {name: "プレビューの内容"}).selectOption("draft");
    await expect(frame.locator('[data-hero-name-part="primary"]')).toContainText("Undo draft");
    await input.press("ControlOrMeta+s");
    await expect.poll(() => mocks.savedPayloads.length).toBe(1);
    expect(mocks.savedPayloads[0]).toEqual({siteName: "Undo draft"});
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("大きく表示からEscapeで編集へ戻り、下書きと画面寸法を保持する", async ({page}, info) => {
    test.skip(info.project.name !== "desktop", "desktop expansion");
    const mocks = await installMocks(page);
    await openSettings(page);
    await chooseSettingsSection(page, "site-basics");
    const input = page.locator('[data-settings-section] input[type="text"]').first();
    await input.fill("Keep draft");
    await page.getByRole("button", {name: "スマホ幅", exact: true}).click();
    await page.getByRole("button", {name: "大きく表示", exact: true}).click();
    await expect(page.locator(".admin-settings-form-layout")).toBeHidden();
    await expect(page.locator(".admin-preview-save-dock")).toContainText("未保存");
    await page.frameLocator('iframe[title="Site Preview"]').locator("body").click({position: {x: 5, y: 5}});
    await page.keyboard.press("Escape");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("Keep draft");
    await expect(page.getByRole("button", {name: "大きく表示", exact: true})).toBeFocused();
    expect(mocks.writes).toEqual([]);
  });

  test("320pxでも項目選択・編集・プレビューを往復して下書きを保持する", async ({page}, info) => {
    test.skip(info.project.name !== "mobile", "mobile editing");
    await page.setViewportSize({width: 320, height: 812});
    const mocks = await installMocks(page);
    await openSettings(page);
    await chooseSettingsSection(page, "site-basics");
    const input = page.locator('[data-settings-section] input[type="text"]').first();
    await input.fill("Mobile draft");
    await openPreview(page);
    await expect(page.locator("[data-settings-preview]")).toBeVisible();
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
    await page.getByRole("button", {name: "編集", exact: true}).click();
    await expect(input).toHaveValue("Mobile draft");
    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });
});


test("admin — 以前の表示値が残っていてもHEROと配色の下書き・保存が公開表示に反映される", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "設定・プレビューの往復はdesktopで確認");
  const mocks = await installMocks(page, true);
  await openSettings(page);
  await chooseSettingsSection(page, "hero");
  await page.getByRole("button", { name: /^大小をつける/ }).click();
  await openPreview(page);
  const preview = page.frameLocator('iframe[title="Site Preview"]');
  await expect(preview.locator('.top-page[data-hero-mode="editorial"]')).toBeVisible();
  await expect(preview.locator(".photo-app")).toHaveCount(0);
  expect(mocks.writes).toEqual([]);
  await chooseSettingsSection(page, "theme");
  await page.getByLabel("背景色（HEX）", { exact: true }).fill("#ebe7df");
  await expect.poll(() => preview.locator("html").evaluate(el => el.style.getPropertyValue("--background").trim())).toBe("#ebe7df");
  await page.locator("[data-settings-save-panel] .admin-form-save-panel__primary").click();
  await expect.poll(() => mocks.savedPayloads.length).toBe(1);
  expect(mocks.savedPayloads[0]).toEqual({ heroMode: "editorial", themeBg: "#ebe7df" });
  await page.reload();
  await expect(preview.locator('.top-page[data-hero-mode="editorial"]')).toBeVisible();
  await expect.poll(() => preview.locator("html").evaluate(el => el.style.getPropertyValue("--background").trim())).toBe("#ebe7df");
  expect(mocks.unknownWrites).toEqual([]);
});
