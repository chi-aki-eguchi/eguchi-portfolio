import { test, expect, type Page, type Route } from "@playwright/test";

// 共通ページ枠の見出しが、狭い画面で1文字ずつ縦に積まれないことを幾何で固定する。
// 実測で 390px のとき見出しが 幅43px × 高さ383px になっていた（font-size 34px）。
//
// ログインせず `/api/**` を人工データで塞ぐため、本番DBへは触らない。
// タブ移動はしない：`/admin` を開いた直後の既定タブ（はじめに）が、見出しの右に
// 操作を3つ持つ最も厳しい条件で、実際に壊れていた画面でもある。
// 9タブの左端が揃うことは admin-page-frame.spec.ts が別途見ている。

// **設定はわざと最小にする。** プロフィールや連絡先まで埋めると「はじめに」の
// 手順が進み、見出しの右の操作（「次へ: …」）が消えて、壊れ方を再現できない。
// 実測でもこの最小設定のときだけ 390px で見出しが縦積みになっていた。
const SETTINGS = {
  siteName: "検査用サイト",
  servicePageMode: "off",
};

const ADMIN_TABS = [
  "setup",
  "gallery",
  "hero",
  "profile",
  "categories",
  "series",
  "pricing",
  "service",
  "settings",
] as const;

type Rgb = { r: number; g: number; b: number };

function rgb(value: string): Rgb {
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);
  if (!match) throw new Error(`RGB値を読めません: ${value}`);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: Rgb, background: Rgb, opacity: number): number {
  const composite = {
    r: foreground.r * opacity + background.r * (1 - opacity),
    g: foreground.g * opacity + background.g * (1 - opacity),
    b: foreground.b * opacity + background.b * (1 - opacity),
  };
  const [light, dark] = [luminance(composite), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}

async function installAdminApiMocks(page: Page, settings = SETTINGS) {
  const nonGet: string[] = [];
  const json = (value: unknown) => (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      nonGet.push(`${request.method()} ${request.url()}`);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "write blocked in geometry smoke" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.route("**/api/images/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from([]) }),
  );
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route("**/api/admin/photos/trash**", json({ photos: [] }));
  await page.route("**/api/settings**", json(settings));
  await page.route("**/api/photos**", json({ photos: [] }));
  await page.route("**/api/categories**", json({ categories: [] }));
  await page.route("**/api/series**", json({ series: [] }));
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  await page.route("**/api/note-posts**", json({ posts: [] }));

  return { nonGet };
}

async function openAdminTab(page: Page, tab: (typeof ADMIN_TABS)[number]) {
  await page.evaluate((nextTab) => {
    localStorage.setItem("admin:tab", JSON.stringify(nextTab));
  }, tab);
  await page.reload();
  await page.waitForSelector(".admin-atelier", { timeout: 15_000 });
  // 初回の画面切替アニメーションではなく、静止した通常状態だけを測る。
  await page.waitForTimeout(350);
}

async function languageToggleSample(page: Page) {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    };
    const backgroundBehind = (element: Element) => {
      const parse = (color: string) => {
        const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(
          color,
        );
        if (!match) return null;
        return {
          a: match[4] === undefined ? 1 : Number(match[4]),
          b: Number(match[3]),
          g: Number(match[2]),
          r: Number(match[1]),
        };
      };
      const chain: Element[] = [];
      for (let current: Element | null = element; current; current = current.parentElement) {
        chain.push(current);
      }
      let painted = { a: 0, b: 0, g: 0, r: 0 };
      for (const current of chain.reverse()) {
        const paint = parse(getComputedStyle(current).backgroundColor);
        if (!paint || paint.a === 0) continue;
        const alpha = paint.a + painted.a * (1 - paint.a);
        painted = {
          a: alpha,
          b: (paint.b * paint.a + painted.b * painted.a * (1 - paint.a)) / alpha,
          g: (paint.g * paint.a + painted.g * painted.a * (1 - paint.a)) / alpha,
          r: (paint.r * paint.a + painted.r * painted.a * (1 - paint.a)) / alpha,
        };
      }
      return `rgb(${Math.round(painted.r)}, ${Math.round(painted.g)}, ${Math.round(painted.b)})`;
    };
    const toggle = Array.from(
      document.querySelectorAll("[data-admin-language-toggle]"),
    ).find(isVisible);
    if (!toggle) throw new Error("表示中の言語切替がありません");
    const selected = toggle.querySelector("button[data-active=\"true\"]");
    const unselected = toggle.querySelector("button:not([data-active=\"true\"])");
    if (!selected || !unselected) throw new Error("言語の選択状態を読めません");
    const sample = (button: Element) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return {
        background: backgroundBehind(button),
        color: style.color,
        fontWeight: Number(style.fontWeight),
        height: rect.height,
        opacity: Number(style.opacity),
        width: rect.width,
      };
    };
    return {
      active: sample(selected),
      inactive: sample(unselected),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

test.describe("admin — 共通ページ枠の見出しの形", () => {
  for (const width of [320, 390, 768, 1440] as const) {
    test(`${width}px: 見出しが縦積みにならず、操作も画面内に収まる`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "画面幅はこのスペックの中で明示指定する",
      );

      const mocks = await installAdminApiMocks(page);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        // 「はじめに」を明示して開く。既定タブは前回の状態に左右されるため。
        localStorage.setItem("admin:tab", JSON.stringify("setup"));
        sessionStorage.clear();
      });
      await page.goto("/admin");
      await page.waitForSelector(".admin-atelier", { timeout: 15_000 });

      const title = page.locator("h1.admin-page-header__title").first();
      await title.waitFor({ timeout: 15_000 });

      const box = await title.boundingBox();
      expect(box, "見出しの大きさを測れる").not.toBeNull();
      const fontSize = Number(
        await title.evaluate((el) =>
          getComputedStyle(el).fontSize.replace("px", ""),
        ),
      );

      expect(
        box!.height,
        `${width}px で見出しが縦に積まれている（高さ ${Math.round(box!.height)}px / 文字 ${fontSize}px、幅 ${Math.round(box!.width)}px）`,
      ).toBeLessThanOrEqual(fontSize * 3);

      // 見出しの隣の操作が画面外へ出ていないこと
      const header = title.locator("xpath=ancestor::div[2]");
      const actions = header.locator("button");
      const actionCount = await actions.count();
      for (let i = 0; i < actionCount; i += 1) {
        const actionBox = await actions.nth(i).boundingBox();
        if (!actionBox) continue;
        expect(
          actionBox.x,
          `${width}px: 操作${i} の左端が画面外`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          actionBox.x + actionBox.width,
          `${width}px: 操作${i} の右端が画面外`,
        ).toBeLessThanOrEqual(width + 1);
      }

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(
        scrollWidth,
        `${width}px で横スクロールが出ている`,
      ).toBeLessThanOrEqual(width);

      expect(mocks.nonGet, "本番へ書き込む要求が出ていない").toEqual([]);
    });
  }

  for (const [language, expectedNote] of [
    ["ja", "作品をシリーズにまとめます。写真の割り当てはLibraryで行います。"],
    ["en", "Group work into series. Assign photos from Library."],
  ] as const) {
    test(`390px / ${language}: Seriesの説明は写真の割り当てを残して2行以内`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "画面幅はこのスペックの中で明示指定する",
      );

      // 初回セットアップの強制遷移を避け、Seriesを開いた状態だけを測る。
      const mocks = await installAdminApiMocks(page, {
        ...SETTINGS,
        setupCompleted: "true",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript((nextLanguage) => {
        localStorage.setItem("admin:tab", JSON.stringify("series"));
        localStorage.setItem("admin:language", nextLanguage);
        sessionStorage.clear();
      }, language);
      await page.goto("/admin");
      await page.waitForSelector(".admin-atelier", { timeout: 15_000 });

      const note = page.locator(".ax-page-title__note");
      await expect(note).toHaveText(expectedNote);
      const geometry = await note.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          height: element.getBoundingClientRect().height,
          lineHeight: Number(style.lineHeight.replace("px", "")),
        };
      });

      expect(geometry.lineHeight, "説明文の行間を測れる").toBeGreaterThan(0);
      expect(
        geometry.height,
        `${language}: Seriesの説明が390pxで3行以上になっている`,
      ).toBeLessThanOrEqual(geometry.lineHeight * 2 + 1);
      expect(mocks.nonGet, "本番へ書き込む要求が出ていない").toEqual([]);
    });
  }
});

test.describe("admin — 言語切替の読める濃度", () => {
  const themes = [
    { name: "light", settings: {} },
    {
      name: "dark",
      settings: { themeBg: "#121212", themeText: "#e8e8e8" },
    },
  ] as const;

  for (const theme of themes) {
    test(`${theme.name}: 全タブで未選択言語を読め、選択状態を区別できる`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !["desktop", "mobile", "mobile-touch"].includes(testInfo.project.name),
        "desktop・390px・タッチ390pxだけを測る",
      );

      if (testInfo.project.name === "desktop") {
        await page.setViewportSize({ width: 1440, height: 900 });
      } else if (testInfo.project.name === "mobile") {
        await page.setViewportSize({ width: 390, height: 844 });
      }

      const mocks = await installAdminApiMocks(page, {
        ...SETTINGS,
        ...theme.settings,
        setupCompleted: "true",
      });
      await page.addInitScript(() => {
        localStorage.setItem("admin:language", "ja");
        localStorage.setItem("admin:tab", JSON.stringify("gallery"));
        sessionStorage.clear();
      });
      await page.goto("/admin");
      await page.waitForSelector(".admin-atelier", { timeout: 15_000 });
      await page.waitForTimeout(350);

      const toggle = page.locator("[data-admin-language-toggle]:visible");
      await expect(toggle).toHaveCount(1);
      const japanese = toggle.getByRole("button", { name: "JP", exact: true });
      const english = toggle.getByRole("button", { name: "EN", exact: true });
      await expect(japanese).toHaveAttribute("aria-pressed", "true");
      await expect(english).toHaveAttribute("aria-pressed", "false");

      const expectReadable = async (tab: string) => {
        const sample = await languageToggleSample(page);
        const inactiveContrast = contrastRatio(
          rgb(sample.inactive.color),
          rgb(sample.inactive.background),
          sample.inactive.opacity,
        );
        const activeContrast = contrastRatio(
          rgb(sample.active.color),
          rgb(sample.active.background),
          sample.active.opacity,
        );
        expect(
          inactiveContrast,
          `${theme.name}/${tab}: 未選択言語が背景と4.5:1以上で読める`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          activeContrast,
          `${theme.name}/${tab}: 選択中言語が背景と4.5:1以上で読める`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(sample.inactive.opacity, `${theme.name}/${tab}: 未選択は透明化しない`).toBe(1);
        expect(sample.active.color, `${theme.name}/${tab}: 選択状態は色でも区別する`).not.toBe(
          sample.inactive.color,
        );
        expect(
          sample.active.fontWeight,
          `${theme.name}/${tab}: 選択状態は太さでも区別する`,
        ).toBeGreaterThan(sample.inactive.fontWeight);
        expect(sample.scrollWidth, `${theme.name}/${tab}: 横あふれなし`).toBeLessThanOrEqual(
          sample.viewportWidth,
        );
      };

      await expectReadable("gallery");
      if (testInfo.project.name !== "mobile-touch") {
        await english.hover();
        // Button colour uses the shared quiet transition. Measure its settled
        // visual state rather than the first interpolation frame.
        await page.waitForTimeout(200);
        const hover = await languageToggleSample(page);
        expect(hover.inactive.color, `${theme.name}: hoverは選択中と同じink`).toBe(
          hover.active.color,
        );
      }
      await english.focus();
      await expect(english).toBeFocused();
      await english.click();
      await expect(english).toHaveAttribute("aria-pressed", "true");
      await expect(japanese).toHaveAttribute("aria-pressed", "false");
      await japanese.click();
      await expect(japanese).toHaveAttribute("aria-pressed", "true");

      for (const tab of ADMIN_TABS) {
        await openAdminTab(page, tab);
        await expectReadable(tab);
      }

      if (testInfo.project.name === "mobile-touch") {
        const boxes = await Promise.all([
          japanese.boundingBox(),
          english.boundingBox(),
        ]);
        for (const box of boxes) {
          expect(box, "タッチ用の言語切替を測れる").not.toBeNull();
          expect(box!.width, "タッチ用の言語切替は32px以上").toBeGreaterThanOrEqual(32);
          expect(box!.height, "タッチ用の言語切替は32px以上").toBeGreaterThanOrEqual(32);
        }
      }

      expect(mocks.nonGet, "言語切替と表示確認で書き込みを出さない").toEqual([]);
    });
  }
});
