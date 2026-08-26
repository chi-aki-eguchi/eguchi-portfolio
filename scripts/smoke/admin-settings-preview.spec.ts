import { expect, test, type Page, type Route } from "@playwright/test";
import { SETTINGS_SECTION_COUNT } from "./helpers";

// Settings のプレビュー Workspace（Phase 1A）。実測で確定した P1〜P6 の回帰を
// 止めるための検査。仕様は docs/specs/admin-phase1-settings-preview.md §12-1。
// 本番と同じDBへ繋がないよう、APIはすべて人工データで差し替える。

const SETTINGS = {
  setupCompleted: "true",
  siteName: "Preview workspace fixture",
  siteNameEn: "Preview workspace fixture",
  siteDescription: "人工データだけで確認するプレビュー",
  gallerySortOrder: "manual",
  gallerySeed: "1",
  servicePageMode: "off",
};

async function installMocks(page: Page) {
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, ignoredKeys: [] }),
    });
  });

  return { writes, unknownWrites };
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

test.describe("admin — Settings プレビュー Workspace", () => {
  test("プレビューを開いても目次は縦のまま全節へ到達でき、横に溢れない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "横並びは1024px以上");

    const mocks = await installMocks(page);
    await openSettings(page);
    await openPreview(page);

    // P4 の回帰防止: 以前は目次が横帯へ変わり、19節のうち一部が切れていた。
    const nav = page.locator(".admin-form-toc__nav");
    const shape = await nav.evaluate((el) => ({
      direction: getComputedStyle(el).flexDirection,
      hidden: el.scrollWidth - el.clientWidth,
    }));
    expect(shape.direction).toBe("column");
    expect(shape.hidden).toBeLessThanOrEqual(1);
    await expect(page.locator("[data-settings-section-link]")).toHaveCount(SETTINGS_SECTION_COUNT);

    // 最後の節まで実際に選べ、本文がその節へ入れ替わる。
    await page.locator(".admin-form-toc__advanced > summary").click();
    const last = page.locator("[data-settings-section-link]").last();
    const lastId = await last.getAttribute("data-settings-section-link");
    await last.click();
    await expect(page.locator("[data-settings-section]")).toHaveCount(1);
    await expect(page.locator("[data-settings-section]")).toHaveAttribute(
      "data-settings-section",
      lastId ?? "",
    );

    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("開閉ボタンは最下部までスクロールしても届き、上部操作はstickyに残る", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "横並びは1024px以上");

    await installMocks(page);
    await openSettings(page);
    await openPreview(page);

    const layout = page.locator(".admin-settings-form-layout");
    await layout.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);

    // P6: 開閉ボタンは sticky な目次の中にあるので画面内に残る。
    const toggle = page.getByRole("button", { name: "プレビューを閉じる" });
    await expect(toggle).toBeInViewport();

    const toolbar = page.locator(".admin-settings-preview__toolbar");
    await expect(toolbar).toBeInViewport();
    await page.locator(".admin-settings-preview__stage").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(toolbar).toBeInViewport();
  });

  test("プレビュー操作のラベルは1行に収まり、グループ単位で折り返す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "横並びは1024px以上");

    await installMocks(page);
    await openSettings(page);
    await openPreview(page);

    // P5 の回帰防止: 以前は「スマホ幅」が1文字ずつ縦に折れていた。
    const controls = page.locator(
      ".admin-settings-preview__toolbar button, .admin-settings-preview__toolbar a",
    );
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(6);
    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      // 折り返しは行数で測る。テキストノードを Range で囲むと、実際に何行へ
      // 分かれたかがそのまま矩形の数になる。
      const info = await control.evaluate((el) => {
        const textNode = Array.from(el.childNodes).find(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );
        if (!textNode) return { text: "", lines: 1 };
        const range = document.createRange();
        range.selectNodeContents(textNode);
        return {
          text: (textNode.textContent ?? "").trim(),
          lines: range.getClientRects().length,
        };
      });
      expect(info.lines, `${info.text} が2行以上になっている`).toBeLessThanOrEqual(
        1,
      );
    }

    // 最小幅まで詰めても、要素は列の外へ出ない。
    await page.locator("[data-settings-preview-resizer]").focus();
    await page.keyboard.press("Home");
    await page.waitForTimeout(150);
    const escaped = await page
      .locator("[data-settings-preview]")
      .evaluate((pane) => {
        const paneRect = pane.getBoundingClientRect();
        return Array.from(
          pane.querySelectorAll(
            ".admin-settings-preview__toolbar button, .admin-settings-preview__toolbar a",
          ),
        ).filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.right > paneRect.right + 1 || rect.left < paneRect.left - 1;
        }).length;
      });
    expect(escaped).toBe(0);
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("幅はキーボードで変えられ、範囲を超えず、再読み込み後も残る", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "横並びは1024px以上");

    await installMocks(page);
    await openSettings(page);
    await openPreview(page);

    const pane = page.locator("[data-settings-preview]");
    const resizer = page.locator("[data-settings-preview-resizer]");
    const paneWidth = () =>
      pane.evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const formWidth = () =>
      page
        .locator(".admin-settings-workspace__form")
        .evaluate((el) => Math.round(el.getBoundingClientRect().width));

    const before = await paneWidth();
    await resizer.focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(120);
    expect(await paneWidth()).toBe(before + 16);

    await page.keyboard.press("Shift+ArrowRight");
    await page.waitForTimeout(120);
    expect(await paneWidth()).toBe(before - 48);

    // End = 最大。ここでもフォーム列は 400px を割らない。
    await page.keyboard.press("End");
    await page.waitForTimeout(150);
    const widest = await paneWidth();
    const min = Number(await resizer.getAttribute("aria-valuemin"));
    const max = Number(await resizer.getAttribute("aria-valuemax"));
    expect(widest).toBeLessThanOrEqual(max + 1);
    expect(await formWidth()).toBeGreaterThanOrEqual(400);

    await page.keyboard.press("Home");
    await page.waitForTimeout(150);
    expect(await paneWidth()).toBe(min);
    expect(min).toBe(320);

    // 比率で保存しているので、再読み込みしても同じ幅で開く。
    await page.reload();
    await page.waitForSelector("[data-settings-preview]", { timeout: 20_000 });
    await page.waitForTimeout(400);
    expect(await paneWidth()).toBe(min);

    // 明示ボタンでも標準幅へ戻る(§3-3)。
    const standard = 480;
    await page.getByRole("button", { name: "幅を戻す" }).click();
    await page.waitForTimeout(150);
    expect(await paneWidth()).toBe(standard);
    // 標準幅のときは戻す操作を出さない。
    await expect(page.getByRole("button", { name: "幅を戻す" })).toBeHidden();

    // ダブルクリックでも標準幅へ戻る。
    await resizer.focus();
    await page.keyboard.press("Home");
    await page.waitForTimeout(150);
    expect(await paneWidth()).toBe(min);
    await resizer.dblclick();
    await page.waitForTimeout(150);
    expect(await paneWidth()).toBe(standard);
  });

  test("境界をドラッグして幅が変わり、下限・上限を超えない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "横並びは1024px以上");

    await installMocks(page);
    await openSettings(page);
    await openPreview(page);

    const pane = page.locator("[data-settings-preview]");
    const resizer = page.locator("[data-settings-preview-resizer]");
    const paneWidth = () =>
      pane.evaluate((el) => Math.round(el.getBoundingClientRect().width));

    const before = await paneWidth();
    const handle = await resizer.boundingBox();
    if (!handle) throw new Error("掴み帯が見つからない");
    const centerY = handle.y + handle.height / 2;

    // 左へ 120px 引くとプレビューが広がる。
    await page.mouse.move(handle.x + handle.width / 2, centerY);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 120, centerY, {
      steps: 8,
    });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const widened = await paneWidth();
    expect(widened).toBeGreaterThan(before + 80);

    // 画面外まで引いても上限を超えない。
    const next = await resizer.boundingBox();
    if (!next) throw new Error("掴み帯が見つからない");
    await page.mouse.move(next.x + next.width / 2, centerY);
    await page.mouse.down();
    await page.mouse.move(0, centerY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const max = Number(await resizer.getAttribute("aria-valuemax"));
    expect(await paneWidth()).toBeLessThanOrEqual(max + 1);
    expect(
      await page
        .locator(".admin-settings-workspace__form")
        .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
    ).toBeGreaterThanOrEqual(400);
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("7つの幅で横に溢れず、目次は縦のまま到達できる", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "幅を変えて確認する");

    await installMocks(page);
    await openSettings(page);
    await openPreview(page);

    for (const width of [1600, 1440, 1280, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 860 });
      await page.waitForTimeout(250);

      expect(
        await documentOverflow(page),
        `${width}px で横スクロールが出ている`,
      ).toBeLessThanOrEqual(1);

      if (width >= 1024) {
        // 横並びの幅では目次が縦のまま19節を保つ(P4 の回帰防止)。
        const nav = page.locator(".admin-form-toc__nav");
        const shape = await nav.evaluate((el) => ({
          direction: getComputedStyle(el).flexDirection,
          hidden: el.scrollWidth - el.clientWidth,
        }));
        expect(shape.direction, `${width}px の目次が横帯になっている`).toBe(
          "column",
        );
        expect(shape.hidden).toBeLessThanOrEqual(1);
        await expect(page.locator("[data-settings-preview]")).toBeVisible();
      } else {
        // 狭い幅では横に並べず、切り替え表示になる。
        const stacked = await page
          .locator(".admin-settings-workspace")
          .evaluate((el) => getComputedStyle(el).flexDirection);
        expect(stacked).toBe("column");
      }
    }
  });

  test("スマホ幅は375pxの枠を横に潰さず、別窓は保存済みサイトを指す", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "横並びは1024px以上");

    await installMocks(page);
    await openSettings(page);
    await openPreview(page);

    await page.getByRole("button", { name: "スマホ幅" }).click();
    await page.waitForTimeout(200);
    const frame = page.locator(".admin-settings-preview__frame");
    // P3: 枠の中身は常に等倍の 375px。列が狭くても横へ縮めない。
    expect(
      await frame.evaluate((el) => Math.round(el.clientWidth)),
    ).toBe(375);

    await page.locator("[data-settings-preview-resizer]").focus();
    await page.keyboard.press("Home");
    await page.waitForTimeout(200);
    expect(
      await frame.evaluate((el) => Math.round(el.clientWidth)),
    ).toBe(375);
    // 潰す代わりに、プレビュー列の内側だけがスクロールする。
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);

    const external = page.locator(".admin-settings-preview__toolbar a");
    await expect(external).toHaveAttribute("href", "/");
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", "noopener");
  });

  test("大きく表示はEscapeで戻り、未保存の入力とプレビュー状態が残る", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "横並びは1024px以上");

    const mocks = await installMocks(page);
    await openSettings(page);
    await openPreview(page);

    await page.locator('[data-settings-section-link="site-basics"]').click();
    const input = page
      .locator("[data-settings-section] input[type='text']")
      .first();
    await input.fill("展開しても残る文字");

    await page.getByRole("button", { name: "スマホ幅" }).click();
    await page.waitForTimeout(150);

    const expand = page.getByRole("button", { name: "大きく表示" });
    await expand.click();
    await page.waitForTimeout(200);

    // 全画面 overlay を作らないので、左ナビは隠れず残っている(§5-1)。
    await expect(page.locator(".admin-sidebar, .admin-sidebar-compact").first())
      .toBeVisible();
    await expect(page.locator(".admin-settings-form-layout")).toBeHidden();
    // 展開中も PC幅/スマホ幅・同期・再読み込みが実際に効く。
    const sync = page.getByRole("button", { name: /同期/ });
    const syncBefore = await sync.getAttribute("aria-pressed");
    await sync.click();
    await expect(sync).toHaveAttribute(
      "aria-pressed",
      syncBefore === "true" ? "false" : "true",
    );
    await sync.click();
    await expect(sync).toHaveAttribute("aria-pressed", syncBefore ?? "true");

    await page.getByRole("button", { name: "PC幅" }).click();
    await expect(page.getByRole("button", { name: "PC幅" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "スマホ幅" }).click();
    await expect(page.locator(".admin-settings-preview__frame")).toHaveAttribute(
      "data-device",
      "mobile",
    );

    const reloaded = page.waitForResponse(
      (response) =>
        response.request().resourceType() === "document" &&
        response.url().includes("/"),
      { timeout: 10_000 },
    );
    await page.getByRole("button", { name: "再読み込み" }).click();
    await reloaded;
    await expect(page.locator(".admin-settings-preview__unsaved")).toContainText(
      "未保存",
    );

    // iframe の中へフォーカスがある状態でも Escape で戻れる。
    await page
      .frameLocator('iframe[title="Site Preview"]')
      .locator("body")
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await expect(page.locator(".admin-settings-form-layout")).toBeVisible();
    // 戻ったとき「大きく表示」へフォーカスを返す。
    await expect(page.getByRole("button", { name: "大きく表示" })).toBeFocused();
    // 未保存の入力もプレビューの表示幅も保たれている。
    await expect(input).toHaveValue("展開しても残る文字");
    await expect(
      page.getByRole("button", { name: "スマホ幅" }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });

  test("375pxは編集↔プレビューを1操作で往復し、入力を保持する", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "狭い幅の切り替えを確認する");

    const mocks = await installMocks(page);
    await openSettings(page);

    const input = page
      .locator("[data-settings-section] input[type='text']")
      .first();
    await input.fill("スマホでも残る文字");

    // 上部 sticky の中から1操作でプレビューへ移る。下部固定バーは増やさない。
    await openPreview(page);
    await expect(page.locator("[data-settings-preview]")).toBeVisible();
    await expect(page.locator(".admin-settings-form-layout__inner")).toBeHidden();
    await expect(page.locator(".admin-floating-save-bar")).toBeHidden();
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
    // 狭い幅では「大きく表示」を出さない（既に全面のため）。
    await expect(page.getByRole("button", { name: "大きく表示" })).toBeHidden();

    await page.getByRole("button", { name: "編集", exact: true }).click();
    await expect(page.locator(".admin-settings-form-layout__inner")).toBeVisible();
    await expect(input).toHaveValue("スマホでも残る文字");

    expect(mocks.writes).toEqual([]);
    expect(mocks.unknownWrites).toEqual([]);
  });
});
