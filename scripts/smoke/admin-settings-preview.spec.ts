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

// 作品の詳細を「確認するページ」から直接選ぶ（2026-09-17）。一覧は管理用API、
// 詳細は公開APIの人工データ。非公開の作品は公開APIに出ないので選べない。
test.describe("admin — プレビューで作品を直接選ぶ", () => {
  const WORK_PATH = "/work/%E6%B8%AF%202026";
  const LONG_TITLE = "港で働く人たちの一年を追いかけた長い題名の作品".repeat(3);
  const row = (id: number, slug: string, title: string, kind: string, isPublished = true) => ({
    id, slug, title, kind, isPublished,
    subtitle: "", statement: "", coverPhotoId: null, sortOrder: id, themeConfig: null,
  });
  const ROWS = [
    row(1, "harbour", "港の記録", "series"),
    row(2, "draft", "下書きの作品", "series", false),
    row(3, "港 2026", LONG_TITLE, "work"),
  ];

  async function installWorks(page: Page) {
    const state = { failing: false, listCalls: 0 };
    await page.route("**/api/admin/series**", (route) => {
      state.listCalls += 1;
      if (state.failing)
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "test failure" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ series: ROWS }) });
    });
    await page.route("**/api/series/**", (route) => {
      const slug = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "");
      const found = ROWS.find((r) => r.slug === slug && r.isPublished);
      return route.fulfill({
        status: found ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(found ? { series: found, photos: [] } : { error: "Not found" }),
      });
    });
    return state;
  }

  const framePath = (page: Page) =>
    page.locator('iframe[title="Site Preview"]').evaluate((el: HTMLIFrameElement) => el.contentWindow!.location.pathname);
  const frameBackground = (page: Page) =>
    page.frameLocator('iframe[title="Site Preview"]').locator("html").evaluate((el) => el.style.getPropertyValue("--background").trim());

  test("作品を選ぶと、プレビューと公開リンクが同じ作品を指し、下書きと寸法を保つ", async ({page}, info) => {
    test.skip(!["desktop", "mobile"].includes(info.project.name), "PCとスマホ幅で確認");
    const mobile = info.project.name === "mobile";
    if (mobile) await page.setViewportSize({width: 390, height: 844});
    const mocks = await installMocks(page);
    await installWorks(page);
    await openSettings(page);
    await chooseSettingsSection(page, "theme");
    const background = page.getByLabel("背景色（HEX）", { exact: true });
    await background.fill("#ebe7df");
    await openPreview(page);

    const select = page.getByRole("combobox", {name: "確認するページ"});
    await expect(select.locator('option[value="/work"]')).toHaveText("Work");
    await expect(select.locator('option[value="/series/draft"]')).toBeDisabled();
    await expect(select.locator('option[value="/series/draft"]')).toHaveText("下書きの作品（非公開・確認不可）");
    await select.selectOption(WORK_PATH);

    await expect.poll(() => framePath(page)).toBe(WORK_PATH);
    const frame = page.frameLocator('iframe[title="Site Preview"]');
    await expect(frame.locator("h1")).toHaveText(LONG_TITLE);
    await expect(frame.getByRole("link", {name: "← Work"})).toHaveAttribute("href", "/work");
    await expect(page.locator(".studio-preview-status a")).toHaveAttribute("href", WORK_PATH);
    await expect(page.locator(".studio-preview-note")).toHaveCount(0);
    await expect.poll(() => frameBackground(page)).toBe("#ebe7df");

    // 端末の寸法と、編集中／保存済みの切り替えでは確認中のページを変えない。
    await page.getByRole("button", {name: mobile ? "PC幅" : "スマホ幅", exact: true}).click();
    await expect.poll(() => framePath(page)).toBe(WORK_PATH);
    await page.getByRole("combobox", {name: "プレビューの内容"}).selectOption("saved");
    await expect.poll(() => frameBackground(page)).not.toBe("#ebe7df");
    await page.getByRole("combobox", {name: "プレビューの内容"}).selectOption("draft");
    await expect.poll(() => frameBackground(page)).toBe("#ebe7df");
    await expect.poll(() => framePath(page)).toBe(WORK_PATH);
    await expect(select).toHaveValue(WORK_PATH);

    // 長い作品名を選んでも、欄の外へはみ出さない。
    const widths = mobile ? [390] : [1440, 1024, 768];
    for (const width of widths) {
      await page.setViewportSize({width, height: mobile ? 844 : 900});
      await openPreview(page);
      expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
      const pane = (await page.locator("[data-settings-preview]").boundingBox())!;
      const box = (await select.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(pane.x + pane.width + 1);
    }

    if (mobile) await page.getByRole("button", {name: "編集", exact: true}).click();
    await expect(background).toHaveValue("#ebe7df");
    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("作品の一覧が読めないときは理由を出し、再読み込みで選べるようになる", async ({page}, info) => {
    test.skip(info.project.name !== "desktop", "desktop failure path");
    const mocks = await installMocks(page);
    const works = await installWorks(page);
    works.failing = true;
    await openSettings(page);
    await openPreview(page);
    const note = page.locator(".studio-preview-note");
    await expect(note).toContainText("作品の一覧を読み込めませんでした。");
    const select = page.getByRole("combobox", {name: "確認するページ"});
    await expect(select.locator("option", {hasText: "作品の一覧を読み込めませんでした"})).toBeDisabled();
    // 固定ページは失敗中も使える。
    await expect(page.locator(".studio-preview-status a")).toHaveAttribute("href", "/");
    await expect.poll(() => framePath(page)).toBe("/");

    works.failing = false;
    const before = works.listCalls;
    await note.getByRole("button", {name: "再読み込み"}).click();
    await expect(note).toHaveCount(0);
    expect(works.listCalls).toBeGreaterThan(before);
    await select.selectOption("/series/harbour");
    await expect.poll(() => framePath(page)).toBe("/series/harbour");
    await expect(page.locator(".studio-preview-status a")).toHaveAttribute("href", "/series/harbour");
    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });
});
