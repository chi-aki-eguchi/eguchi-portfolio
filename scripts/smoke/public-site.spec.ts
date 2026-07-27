import { expect, test, type Page, type Route } from "@playwright/test";

type PublicPage = {
  label: string;
  path: string;
  hasH1: boolean;
  readySelector?: string;
  readyText?: RegExp;
};

type PublicApiMocks = {
  unexpectedRequests: string[];
};

const PUBLIC_PAGES: PublicPage[] = [
  {
    label: "トップ",
    path: "/",
    hasH1: true,
    readySelector: "main .photo-card",
  },
  {
    label: "Gallery",
    path: "/gallery",
    hasH1: true,
    readySelector: "main .photo-card",
  },
  {
    label: "About",
    path: "/about",
    hasH1: true,
    readyText: /Journal/,
  },
  {
    label: "Contact",
    path: "/contact",
    hasH1: true,
    readySelector: 'main input[name="name"]',
  },
  {
    label: "Series",
    path: "/series",
    hasH1: true,
    readySelector: 'main a[href="/series/synthetic-series-one"]',
  },
  {
    label: "English About",
    path: "/en/about",
    hasH1: true,
    readyText: /Journal/,
  },
  {
    label: "English Contact",
    path: "/en/contact",
    hasH1: true,
    readySelector: 'main input[name="name"]',
  },
  {
    label: "404",
    path: "/this-page-does-not-exist",
    hasH1: false,
    readyText: /Page not found|見つかりません|404/i,
  },
];

const VIEWPORT_WIDTHS = [320, 390, 768, 1440] as const;

// This is an opaque 4x4 blue-gray PNG. A successful request paints a real image,
// rather than hiding broken-image layout behind an aborted R2 request.
const SOLID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVR4nGMoqOuBIwbiOABk0hehHKJliQAAAABJRU5ErkJggg==",
  "base64",
);

const SYNTHETIC_PHOTOS = Array.from({ length: 18 }, (_, index) => {
  const portrait = index % 2 === 1;
  const id = 9_100_001 + index;
  const imageName = `synthetic-smoke-photo-${String(index + 1).padStart(2, "0")}.png`;
  return {
    id,
    filename: imageName,
    url: `/api/images/synthetic-smoke/${imageName}`,
    thumbUrl: `/api/images/synthetic-smoke/thumb-${imageName}`,
    mediumUrl: `/api/images/synthetic-smoke/medium-${imageName}`,
    title: `Synthetic smoke photo ${index + 1}`,
    meta: "",
    description: `Artificial ${portrait ? "portrait" : "landscape"} test image`,
    category: index % 3 === 0 ? "synthetic-people" : "synthetic-places",
    camera: null,
    lens: null,
    focalLength: null,
    fNumber: null,
    exposureTime: null,
    iso: null,
    filmType: index % 2 === 0 ? "デジタル" : "フィルム",
    shotAt: null,
    displaySize: (["S", "M", "L"] as const)[index % 3],
    width: portrait ? 800 : 1200,
    height: portrait ? 1200 : 800,
    rotationDeg: 0,
    focalX: 50,
    focalY: 50,
    sortOrder: index,
    seriesId: index < 9 ? 9_200_001 : 9_200_002,
    isPublished: true,
    fileHash: null,
    deletedAt: null,
    createdAt: null,
  };
});

const SYNTHETIC_SETTINGS = {
  siteName: "Synthetic Smoke Studio",
  siteNameEn: "Synthetic Portfolio",
  heroSubtitle: "Artificial photography fixtures",
  heroMode: "single",
  heroDisplayMode: "normal",
  topWorksMode: "auto",
  topWorksLayout: "clean-grid",
  homeGalleryCount: "12",
  galleryLabel: "Gallery",
  galleryLayout: "clean-grid",
  galleryColumns: "3",
  galleryGapScale: "1",
  galleryEmptyRate: "0",
  gallerySizeVariation: "0",
  worksDefaultView: "photos",
  seriesNavEnabled: "on",
  profileLabel: "About",
  profileName: "Synthetic Photographer",
  profileNameEn: "Synthetic Photographer",
  profileBio: "This profile copy exists only inside the smoke test.",
  profileBioEn: "This English profile copy exists only inside the smoke test.",
  profilePhotoUrl: "/api/images/synthetic-smoke/profile.png",
  profileInstagram: "https://example.test/synthetic-instagram",
  profileTwitter: "https://example.test/synthetic-social",
  profileNote: "https://example.test/synthetic-note",
  noteEnabled: "on",
  noteUsername: "synthetic-smoke",
  noteShowCount: "1",
  contactLabel: "Contact",
  contactIntro: "Artificial contact copy for browser checks.",
  contactIntroEn: "Artificial English contact copy for browser checks.",
  contactEmail: "synthetic@example.test",
  formspreeUrl: "https://example.test/synthetic-contact",
  servicePageMode: "off",
  footerCtaLabel: "Contact",
};

const SYNTHETIC_SERIES = [
  {
    id: 9_200_001,
    slug: "synthetic-series-one",
    title: "Synthetic Series One",
    subtitle: "Artificial landscape and portrait set",
    statement: "Fixture data only.",
    coverPhotoId: SYNTHETIC_PHOTOS[0].id,
    coverUrl: SYNTHETIC_PHOTOS[0].url,
    coverRotationDeg: 0,
    coverFocalX: 50,
    coverFocalY: 50,
    sortOrder: 0,
    isPublished: true,
    themeConfig: null,
  },
  {
    id: 9_200_002,
    slug: "synthetic-series-two",
    title: "Synthetic Series Two",
    subtitle: "Second artificial set",
    statement: "Fixture data only.",
    coverPhotoId: SYNTHETIC_PHOTOS[9].id,
    coverUrl: SYNTHETIC_PHOTOS[9].url,
    coverRotationDeg: 0,
    coverFocalX: 50,
    coverFocalY: 50,
    sortOrder: 1,
    isPublished: true,
    themeConfig: null,
  },
];

const SYNTHETIC_CATEGORIES = [
  {
    id: 9_300_001,
    slug: "synthetic-people",
    label: "Synthetic People",
    sortOrder: 0,
  },
  {
    id: 9_300_002,
    slug: "synthetic-places",
    label: "Synthetic Places",
    sortOrder: 1,
  },
];

const SYNTHETIC_NOTE_POSTS = [
  {
    title: "Synthetic journal entry",
    link: "https://example.test/synthetic-journal-entry",
    date: "",
    excerpt: "Artificial note content used only by the public smoke test.",
    thumbnail: "/api/images/synthetic-smoke/note-thumbnail.png",
  },
];

async function fulfillJson(route: Route, value: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(value),
  });
}

async function installPublicApiMocks(page: Page): Promise<PublicApiMocks> {
  const unexpectedRequests: string[] = [];

  // Register the guard first. Playwright checks newer routes first, so every
  // known endpoint below gets its fixed response and any unlisted /api call is
  // stopped before it can reach the local server (and therefore the real DB).
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    unexpectedRequests.push(`${request.method()} ${request.url()}`);
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unexpected API request in public smoke" }),
    });
  });
  await page.route("**/api/images/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: SOLID_PNG,
    });
  });
  await page.route("**/api/settings**", (route) =>
    fulfillJson(route, SYNTHETIC_SETTINGS),
  );
  await page.route("**/api/photos**", (route) =>
    fulfillJson(route, { photos: SYNTHETIC_PHOTOS }),
  );
  await page.route("**/api/hero-photos**", (route) =>
    fulfillJson(route, { heroPhotos: SYNTHETIC_PHOTOS.slice(0, 3) }),
  );
  await page.route("**/api/series**", (route) =>
    fulfillJson(route, { series: SYNTHETIC_SERIES }),
  );
  await page.route("**/api/categories**", (route) =>
    fulfillJson(route, { categories: SYNTHETIC_CATEGORIES }),
  );
  await page.route("**/api/note-posts**", (route) =>
    fulfillJson(route, { posts: SYNTHETIC_NOTE_POSTS }),
  );
  // ContactPage also reads pricing. It is intentionally empty, but still
  // mocked so the smoke test never falls through to the production-backed API.
  await page.route("**/api/pricing**", (route) =>
    fulfillJson(route, { plans: [] }),
  );

  return { unexpectedRequests };
}

function isSameOrigin(sourceUrl: string, documentUrl: string): boolean {
  try {
    return new URL(sourceUrl).origin === new URL(documentUrl).origin;
  } catch {
    return false;
  }
}

function collectPageRuntimeProblems(page: Page): string[] {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    // Only count errors attributed to the local document or its local bundles.
    // External fonts and third-party resources are outside this page's runtime.
    if (!source || !isSameOrigin(source, page.url())) return;
    const line = message.location().lineNumber;
    problems.push(`console: ${message.text()} (${source}:${line})`);
  });
  // An uncaught exception is necessarily raised by the page execution context,
  // so it belongs to this page even when Chromium supplies no source URL.
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });

  return problems;
}

async function gotoPublicPage(page: Page, publicPage: PublicPage) {
  await page.goto(publicPage.path, { waitUntil: "domcontentloaded" });

  if (publicPage.hasH1) {
    await expect(page.locator("h1").first()).toBeVisible();
  }
  if (publicPage.readySelector) {
    await expect(page.locator(publicPage.readySelector).first()).toBeVisible();
  }
  if (publicPage.readyText) {
    await expect(page.getByText(publicPage.readyText).first()).toBeVisible();
  }

  // Wait for only the images currently on screen. Lazy images below the fold
  // are deliberately excluded; waiting for them would turn scrolling policy
  // into an arbitrary timeout.
  //
  // 画像が1枚でも読み込めないと、この待機はテスト全体を落とす。それでは
  // 「横スクロールしない」のような無関係な検査まで道連れになり、何が壊れて
  // いるのか分からなくなる。そこで、ここでは短く待つだけにして落とさず、
  // 読み込みそのものは expectVisibleImagesLoaded で個別に検査する。
  await page
    .waitForFunction(
      () =>
        Array.from(document.images)
          .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < window.innerHeight;
          })
          .every((image) => image.complete && image.naturalWidth > 0),
      undefined,
      { timeout: 4000 },
    )
    .catch(() => {
      /* 読み込めない画像は expectVisibleImagesLoaded が名指しで報告する */
    });
}

/**
 * 画面内の画像が実際に読み込めたかを、どの画像かまで含めて報告する。
 * src が空のまま描画された画像も、ここで見つかる。
 */
async function expectVisibleImagesLoaded(page: Page) {
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .filter((image) => !(image.complete && image.naturalWidth > 0))
      .map((image) => ({
        src: image.currentSrc || image.getAttribute("src") || "(srcなし)",
        alt: image.alt,
      })),
  );
  expect(broken, "画面内で読み込めなかった画像").toEqual([]);
}

async function expectKeyboardReachabilityAndVisibleFocus(page: Page) {
  const targetIds = await page.evaluate(() => {
    const selector =
      'main a[href], main button:not([disabled]), main input:not([disabled]):not([type="hidden"]), main select:not([disabled]), main textarea:not([disabled]), main [tabindex]:not([tabindex="-1"])';
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    ).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        element.tabIndex >= 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });
    const targets = candidates.slice(0, Math.min(2, candidates.length));
    for (const [index, target] of targets.entries()) {
      target.dataset.publicSmokeFocusTarget = String(index);
    }
    return targets.map((_, index) => String(index));
  });

  expect(
    targetIds.length,
    "main内にキーボード操作できる主要要素がない",
  ).toBeGreaterThan(0);

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  const reached = new Map<
    string,
    {
      tag: string;
      text: string;
      focusVisible: boolean;
      visibleIndicator: boolean;
      outlineStyle: string;
      outlineWidth: string;
      outlineColor: string;
      boxShadow: string;
    }
  >();

  for (let press = 0; press < 80 && reached.size < targetIds.length; press++) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const id = active.dataset.publicSmokeFocusTarget;
      if (id === undefined) return null;
      const style = getComputedStyle(active);
      const outlineAlpha = (() => {
        if (style.outlineColor === "transparent") return 0;
        const match = style.outlineColor.match(
          /^rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([^)]+))?\)$/,
        );
        return match?.[1] === undefined ? 1 : Number(match[1]);
      })();
      const outlineVisible =
        style.outlineStyle !== "none" &&
        Number.parseFloat(style.outlineWidth) > 0 &&
        outlineAlpha > 0;
      return {
        id,
        tag: active.tagName.toLowerCase(),
        text:
          active.getAttribute("aria-label") ||
          active.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
          active.getAttribute("name") ||
          "",
        focusVisible: active.matches(":focus-visible"),
        visibleIndicator:
          outlineVisible ||
          (style.boxShadow !== "none" && style.boxShadow !== ""),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        boxShadow: style.boxShadow,
      };
    });
    if (state) reached.set(state.id, state);
  }

  for (const id of targetIds) {
    const state = reached.get(id);
    expect(
      state,
      `main内の主要操作要素 data-public-smoke-focus-target="${id}" にTabで到達できない`,
    ).toBeDefined();
    expect(state).toMatchObject({
      focusVisible: true,
      visibleIndicator: true,
    });
  }
}

test.describe("public-site — 公開ページ基本検査（APIは人工データ）", () => {
  for (const publicPage of PUBLIC_PAGES) {
    test(`${publicPage.label} ${publicPage.path} — console・見出し・画像alt・外部リンク・キーボード`, async ({
      page,
    }) => {
      const runtimeProblems = collectPageRuntimeProblems(page);
      const apiMocks = await installPublicApiMocks(page);

      await gotoPublicPage(page, publicPage);

      if (publicPage.hasH1) {
        await expect(page.locator("h1")).toHaveCount(1);
      }

      const imagesMissingAlt = await page.locator("img:not([alt])").evaluateAll(
        (images) =>
          images.map((image) =>
            image.outerHTML.replace(/\s+/g, " ").slice(0, 180),
          ),
      );
      expect(imagesMissingAlt).toEqual([]);

      await expectVisibleImagesLoaded(page);

      const unsafeBlankLinks = await page
        .locator('a[target="_blank"]')
        .evaluateAll((links) =>
          links
            .map((link) => {
              const rel = new Set(
                (link.getAttribute("rel") ?? "")
                  .toLowerCase()
                  .split(/\s+/)
                  .filter(Boolean),
              );
              return {
                href: link.getAttribute("href") ?? "",
                rel: link.getAttribute("rel") ?? "",
                hasNoopener: rel.has("noopener"),
                hasNoreferrer: rel.has("noreferrer"),
              };
            })
            .filter((link) => !link.hasNoopener || !link.hasNoreferrer),
        );
      expect(unsafeBlankLinks).toEqual([]);

      await expectKeyboardReachabilityAndVisibleFocus(page);

      if (!publicPage.hasH1) {
        const bodyText = (await page.locator("body").innerText()).trim();
        expect(bodyText).toMatch(/Page not found|見つかりません|404/i);
        expect(bodyText.length, "404ページが真っ白に近い").toBeGreaterThan(20);
      }

      expect(apiMocks.unexpectedRequests).toEqual([]);
      expect(runtimeProblems).toEqual([]);
    });
  }
});

test.describe("public-site — 横スクロール検査", () => {
  for (const publicPage of PUBLIC_PAGES) {
    for (const width of VIEWPORT_WIDTHS) {
      test(`${publicPage.label} ${publicPage.path} — ${width}pxで横スクロールなし`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        const runtimeProblems = collectPageRuntimeProblems(page);
        const apiMocks = await installPublicApiMocks(page);

        await gotoPublicPage(page, publicPage);

        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(
          metrics.scrollWidth,
          `${publicPage.path} at ${width}px: scrollWidth=${metrics.scrollWidth}, viewportWidth=${metrics.viewportWidth}`,
        ).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(apiMocks.unexpectedRequests).toEqual([]);
        expect(runtimeProblems).toEqual([]);
      });
    }
  }
});

test.describe("public-site — Galleryライトボックス", () => {
  test("/gallery — 写真クリックで開き、背後を固定し、Escで閉じる", async ({
    page,
  }) => {
    const runtimeProblems = collectPageRuntimeProblems(page);
    const apiMocks = await installPublicApiMocks(page);
    const galleryPage = PUBLIC_PAGES.find(
      (publicPage) => publicPage.path === "/gallery",
    )!;

    await gotoPublicPage(page, galleryPage);

    const photoButton = page
      .locator("main button")
      .filter({ has: page.locator(".photo-card") })
      .nth(4);
    await photoButton.scrollIntoViewIfNeeded();
    const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
    await photoButton.click();

    const lightbox = page.locator('dialog[aria-label="写真ビューア"]');
    await expect(lightbox).toBeVisible();
    await expect(lightbox).toHaveAttribute("open", "");
    await expect
      .poll(() =>
        page.evaluate(() => ({
          bodyOverflow: getComputedStyle(document.body).overflow,
          scrollY: window.scrollY,
        })),
      )
      .toEqual({ bodyOverflow: "hidden", scrollY: scrollBeforeOpen });

    await page.mouse.wheel(0, 700);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);

    await page.keyboard.press("Escape");
    await expect(lightbox).toBeHidden();

    expect(apiMocks.unexpectedRequests).toEqual([]);
    expect(runtimeProblems).toEqual([]);
  });
});
