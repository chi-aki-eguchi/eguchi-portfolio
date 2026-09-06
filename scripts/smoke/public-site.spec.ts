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
    label: "Series detail",
    path: "/series/synthetic-series-one",
    hasH1: true,
    readySelector: "main .photo-card",
  },
  {
    label: "English About",
    path: "/en/about",
    hasH1: true,
    // The English profile intentionally hides untranslated Japanese journal entries.
    readyText: /This English profile copy/,
  },
  {
    label: "Profile alias",
    path: "/profile",
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

// These pages are intentionally separate from PUBLIC_PAGES: the established
// eight-page fixture remains servicePageMode: "off", while only this group
// exercises the routes that are visible when the feature is enabled.
const SERVICE_PAGES: PublicPage[] = [
  {
    label: "Portfolio guide",
    path: "/portfolio-kit/guide",
    hasH1: true,
    readySelector: "main article h1",
  },
  {
    label: "Portfolio Kit",
    path: "/portfolio-kit",
    hasH1: true,
    // ヘッダーのナビにも "Portfolio Kit" があり、そちらは狭い画面で隠れる。
    // 文字ではなく本文の見出しそのものを待つ。
    readySelector: "main h1",
  },
  {
    label: "Portfolio Kit start",
    path: "/start",
    hasH1: true,
    readySelector: "main h1",
  },
];

const VIEWPORT_WIDTHS = [320, 390, 768, 1440] as const;

// 64x64 の不透明な青灰色PNG（136バイト）。実際に描画される画像を返すことで、
// 通信を中断して壊れた画像レイアウトを隠す、という誤魔化しを避ける。
//
// **4x4 では小さすぎる。** 公開側の <img> は `sizes="50vw"` と `srcset`（400w/800w…）を
// 使う。ブラウザは表示に必要な幅から候補を選び、intrinsic な大きさを
// 「画像の実寸 ÷ (候補の宣言幅 ÷ 実際の表示幅)」で決める。高精細なタッチ端末
// （390px幅・DPR 2.625）だと 800w が選ばれ、4 ÷ 約4.1 が1未満になるため
// `naturalWidth` が 0 になる。読み込みは成功しているのに「壊れた画像」と判定され、
// 実測では /series がこれで落ちていた。64pxあればどの画面幅・DPRでも0にならない。
const SOLID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVR42u3PQQkAAAgEsEtsAxsY2gi+hcEKLNXzWgQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQELgtzg3Fa6mxyjAAAAABJRU5ErkJggg==",
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

const LANGUAGE_SWITCH_CASES = [
  {
    label: "About JA→EN",
    path: "/about",
    destination: "/en/about",
    currentLanguage: "JP",
  },
  {
    label: "About EN→JA",
    path: "/en/about",
    destination: "/about",
    currentLanguage: "EN",
  },
  {
    label: "Contact JA→EN",
    path: "/contact",
    destination: "/en/contact",
    currentLanguage: "JP",
  },
  {
    label: "Contact EN→JA",
    path: "/en/contact",
    destination: "/contact",
    currentLanguage: "EN",
  },
] as const;

const LANGUAGE_SWITCH_THEMES = ["light", "dark"] as const;

// These SVG fixtures carry the same decoded dimensions as the generated WebP
// variants we are protecting. A real browser can therefore exercise the
// naturalWidth/clientWidth density decision without reaching the real image
// service or pretending a 64px placeholder has photo-sized pixels.
const SELECTIVE_DENSITY_PHOTOS = [
  {
    ...SYNTHETIC_PHOTOS[0],
    id: 9_100_101,
    title: "Pano density fixture",
    url: "/api/images/selective-density/original-pano.svg",
    thumbUrl: "/api/images/selective-density/thumb-pano.svg",
    mediumUrl: "/api/images/selective-density/medium-pano.svg",
    width: 3200,
    height: 1362,
    sortOrder: 0,
  },
  {
    ...SYNTHETIC_PHOTOS[1],
    id: 9_100_102,
    title: "Landscape density fixture",
    url: "/api/images/selective-density/original-landscape.svg",
    thumbUrl: "/api/images/selective-density/thumb-landscape.svg",
    mediumUrl: "/api/images/selective-density/medium-landscape.svg",
    width: 3200,
    height: 2250,
    sortOrder: 1,
  },
  {
    ...SYNTHETIC_PHOTOS[2],
    id: 9_100_103,
    title: "Portrait density fixture",
    url: "/api/images/selective-density/original-portrait.svg",
    thumbUrl: "/api/images/selective-density/thumb-portrait.svg",
    mediumUrl: "/api/images/selective-density/medium-portrait.svg",
    width: 2250,
    height: 3200,
    sortOrder: 2,
  },
];

const SELECTIVE_DENSITY_IMAGE_SIZES: Record<string, [number, number]> = {
  "original-pano.svg": [3200, 1362],
  "thumb-pano.svg": [640, 272],
  "medium-pano.svg": [1920, 817],
  "original-landscape.svg": [3200, 2250],
  "thumb-landscape.svg": [640, 450],
  "medium-landscape.svg": [1920, 1350],
  "original-portrait.svg": [2250, 3200],
  "thumb-portrait.svg": [640, 910],
  "medium-portrait.svg": [1920, 2731],
};

function solidSvg(width: number, height: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#66758a"/></svg>`;
}

const SYNTHETIC_SERVICE_SETTINGS = {
  ...SYNTHETIC_SETTINGS,
  servicePageMode: "on",
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

async function installPublicApiMocks(
  page: Page,
  settings = SYNTHETIC_SETTINGS,
  /** Work の棚の中身。既定は空——この作品集はシリーズだけを持っている。 */
  workShelf: (typeof SYNTHETIC_SERIES)[number][] = [],
): Promise<PublicApiMocks> {
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
    fulfillJson(route, settings),
  );
  await page.route("**/api/photos**", (route) =>
    fulfillJson(route, { photos: SYNTHETIC_PHOTOS }),
  );
  await page.route("**/api/hero-photos**", (route) =>
    fulfillJson(route, { heroPhotos: SYNTHETIC_PHOTOS.slice(0, 3) }),
  );
  // 棚（2026-08-30）。`?kind=work` は**別の棚**なので、同じ中身を返さない。
  // 返してしまうと「Work が2本ある」状態になり、ナビの項目が1つ増える
  // ——390px では、それだけで JP/EN の当たり面が 0 に潰れた（実測）。
  await page.route("**/api/series**", (route) =>
    fulfillJson(
      route,
      new URL(route.request().url()).searchParams.get("kind") === "work"
        ? { series: workShelf }
        : { series: SYNTHETIC_SERIES },
    ),
  );
  await page.route("**/api/series/synthetic-series-one", (route) =>
    fulfillJson(route, {
      series: SYNTHETIC_SERIES[0],
      photos: SYNTHETIC_PHOTOS.filter(
        (photo) => photo.seriesId === SYNTHETIC_SERIES[0].id,
      ),
    }),
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

async function installSelectiveDensityMocks(page: Page) {
  const apiMocks = await installPublicApiMocks(page, {
    ...SYNTHETIC_SETTINGS,
    galleryLayout: "clean-grid",
    galleryColumns: "8",
  });
  const imageRequests: string[] = [];

  // These routes are registered after the general mocks, so Playwright serves
  // the density fixtures first. The smoke never reaches the development API
  // (and therefore never reaches a production-backed database).
  await page.route("**/api/photos**", (route) =>
    fulfillJson(route, { photos: SELECTIVE_DENSITY_PHOTOS }),
  );
  await page.route("**/api/images/selective-density/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    const dimensions = SELECTIVE_DENSITY_IMAGE_SIZES[name];
    imageRequests.push(name);
    if (!dimensions) {
      await route.fulfill({ status: 404, body: "unknown density fixture" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: solidSvg(...dimensions),
    });
  });

  return { ...apiMocks, imageRequests };
}

async function densityImageState(page: Page) {
  return page.locator("main .photo-card img").evaluateAll((images) =>
    images.map((image) => ({
      src: image.getAttribute("src"),
      currentSrc: image.currentSrc,
      dataSrc: image.getAttribute("data-src"),
      dataSrcset: image.getAttribute("data-srcset"),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      clientWidth: image.clientWidth,
      clientHeight: image.clientHeight,
      complete: image.complete,
    })),
  );
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

async function openMobileLanguageSwitch(page: Page) {
  const menuButton = page.locator('button[aria-controls="mobile-menu"]');
  await expect(menuButton).toBeVisible();
  if ((await menuButton.getAttribute("aria-expanded")) !== "true") {
    await menuButton.click();
  }
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".language-switch:visible")).toBeVisible();
  // The menu's height is animated. Wait until its visible final geometry before
  // sampling the actual pointer target, rather than measuring a mid-transition
  // rectangle that a user cannot reliably tap.
  await page.waitForTimeout(400);
}

async function setPublicTheme(
  page: Page,
  theme: (typeof LANGUAGE_SWITCH_THEMES)[number],
) {
  const currentTheme = () =>
    page.evaluate(() => document.documentElement.dataset.theme ?? "light");
  if ((await currentTheme()) === theme) return;

  const toggleLabel =
    theme === "dark"
      ? "ダークモードに切り替え"
      : "ライトモードに切り替え";
  await page.locator(`button[aria-label="${toggleLabel}"]:visible`).click();
  await expect.poll(currentTheme).toBe(theme);
}

async function measureLanguageSwitchHitArea(page: Page, destination: string) {
  return page
    .locator(`.language-switch a[href="${destination}"]:visible`)
    .evaluate((element) => {
      const link = element as HTMLAnchorElement;
      const hitArea = link.querySelector<HTMLElement>(
        ".language-switch-hit-area",
      );
      if (!hitArea) throw new Error("language switch hit area is missing");

      const visual = link.getBoundingClientRect();
      const hit = hitArea.getBoundingClientRect();
      const centerX = hit.left + hit.width / 2;
      const centerY = hit.top + hit.height / 2;
      const belongsToLink = (x: number, y: number) =>
        document.elementFromPoint(x, y)?.closest("a") === link;
      const continuousDirection = (xDirection: number, yDirection: number) => {
        let length = 0;
        while (
          length < 64 &&
          belongsToLink(
            centerX + xDirection * (length + 0.5),
            centerY + yDirection * (length + 0.5),
          )
        ) {
          length += 1;
        }
        return length;
      };
      let full32pxSquare = true;
      for (let y = 0; y < 32; y += 1) {
        for (let x = 0; x < 32; x += 1) {
          if (!belongsToLink(centerX - 15.5 + x, centerY - 15.5 + y)) {
            full32pxSquare = false;
          }
        }
      }

      return {
        visual: { width: visual.width, height: visual.height },
        hit: {
          width: hit.width,
          height: hit.height,
          position: getComputedStyle(hitArea).position,
        },
        horizontalContinuousHit:
          continuousDirection(-1, 0) + continuousDirection(1, 0),
        verticalContinuousHit:
          continuousDirection(0, -1) + continuousDirection(0, 1),
        full32pxSquare,
        center: { x: centerX, y: centerY },
      };
    });
}

async function expectLanguageSwitchKeyboardFocus(page: Page, destination: string) {
  const link = page.locator(
    `.language-switch a[href="${destination}"]:visible`,
  );
  await link.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  let focusState:
    | {
        active: boolean;
        focusVisible: boolean;
        outlineStyle: string;
        outlineWidth: string;
      }
    | undefined;
  for (let press = 0; press < 80; press += 1) {
    await page.keyboard.press("Tab");
    focusState = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        active: document.activeElement === element,
        focusVisible: element.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    if (focusState.active) break;
  }

  if (!focusState?.active) {
    throw new Error(`keyboard focus did not reach language link ${destination}`);
  }
  expect(focusState.focusVisible).toBe(true);
  expect(focusState.outlineStyle).toBe("solid");
  expect(Number.parseFloat(focusState.outlineWidth)).toBeGreaterThan(0);
}

test("Portfolio Kit — 実演動画は任意再生で、説明と相談へ進める", async ({ page }) => {
  const apiMocks = await installPublicApiMocks(page, SYNTHETIC_SERVICE_SETTINGS);
  await page.goto("/portfolio-kit");
  const video = page.locator("#admin-video video");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).not.toHaveAttribute("autoplay", "");
  await video.scrollIntoViewIfNeeded();
  await video.evaluate(async (element: HTMLVideoElement) => { await element.play(); });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  expect(await video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBe(1440);
  await video.evaluate((element: HTMLVideoElement) => element.pause());
  await page.locator("#admin-video-transcript summary").click();
  await expect(page.locator("#admin-video-transcript")).toContainText("体験版での保存");
  await page.locator('a[href="/portfolio-kit/guide"]').first().click();
  await expect(page.locator("h1")).toHaveText("写真家のポートフォリオサイトの作り方");
  await expect(page.locator('a[href="/portfolio-kit/consult"]').first()).toBeVisible();
  expect(apiMocks.unexpectedRequests).toEqual([]);
});

test.describe("public-site — 公開ページ基本検査（APIは人工データ）", () => {
  for (const { pages, settings } of [
    { pages: PUBLIC_PAGES, settings: SYNTHETIC_SETTINGS },
    { pages: SERVICE_PAGES, settings: SYNTHETIC_SERVICE_SETTINGS },
  ]) {
    for (const publicPage of pages) {
      test(`${publicPage.label} ${publicPage.path} — console・見出し・画像alt・外部リンク・キーボード`, async ({
        page,
      }) => {
        const runtimeProblems = collectPageRuntimeProblems(page);
        const apiMocks = await installPublicApiMocks(page, settings);

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
  }
});

// Screenshot regression, 2026-09-02: the dark reveal backdrop was attached to
// the whole carousel stage. On a light site that turned only the name area
// black, while the saved #404040 name remained dark. Fullscreen carousel also
// placed its name below the viewport despite the admin saying it was overlaid,
// and its object-fit rule targeted the wrapper instead of the actual <img>.
const HERO_NAME_CASES = [
  {
    label: "carousel normal",
    heroMode: "carousel",
    heroDisplayMode: "normal",
    tone: "on-paper",
  },
  {
    label: "carousel fullscreen",
    heroMode: "carousel",
    heroDisplayMode: "fullscreen",
    tone: "over-photo",
  },
  {
    label: "single",
    heroMode: "single",
    heroDisplayMode: "normal",
    tone: "over-photo",
  },
  {
    label: "quiet grid",
    heroMode: "quiet-grid",
    heroDisplayMode: "normal",
    tone: "over-photo",
  },
  {
    label: "editorial",
    heroMode: "editorial",
    heroDisplayMode: "normal",
    tone: "on-paper",
  },
  {
    label: "immersive",
    heroMode: "immersive",
    heroDisplayMode: "normal",
    tone: "over-photo",
  },
] as const;

async function measureHeroName(page: Page) {
  return page
    .locator('main h1[data-hero-name-part="primary"]')
    .evaluate((name) => {
      const rect = name.getBoundingClientRect();
      const stage = name.closest<HTMLElement>(".hero-motion-stage");
      const stageRect = stage?.getBoundingClientRect();
      const carouselViewport = name.closest<HTMLElement>(
        ".hero-carousel-viewport",
      );
      const photoBox =
        carouselViewport ??
        name.closest<HTMLElement>(".hero-single") ??
        (name.getAttribute("data-hero-name-tone") === "over-photo"
          ? stage
          : null);
      const photoRect = photoBox?.getBoundingClientRect();
      const carouselPhoto = document.querySelector<HTMLElement>(
        ".hero-carousel-contain",
      );
      const singlePhoto = document.querySelector<HTMLElement>(".hero-single");
      const carouselImage = document.querySelector<HTMLElement>(
        ".hero-slide.active img",
      );

      const rgb = (value: string) => {
        const values = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
        return values?.length === 3 ? values : null;
      };
      const luminance = (values: number[]) => {
        const channels = values.map((value) => {
          const n = value / 255;
          return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        });
        return (
          0.2126 * channels[0] +
          0.7152 * channels[1] +
          0.0722 * channels[2]
        );
      };
      const contrast = (foreground: string, background: string) => {
        const fg = rgb(foreground);
        const bg = rgb(background);
        if (!fg || !bg) return 0;
        const [light, dark] = [luminance(fg), luminance(bg)].sort(
          (a, b) => b - a,
        );
        return (light + 0.05) / (dark + 0.05);
      };
      const bodyBackground = getComputedStyle(document.body).backgroundColor;
      const paperParts = ["primary", "english", "subtitle"].map((part) => {
        const element = document.querySelector<HTMLElement>(
          `[data-hero-name-part="${part}"]`,
        );
        return {
          part,
          ratio: element
            ? contrast(getComputedStyle(element).color, bodyBackground)
            : 0,
        };
      });
      const within =
        !!stageRect &&
        rect.left >= stageRect.left - 1 &&
        rect.right <= stageRect.right + 1 &&
        rect.top >= stageRect.top - 1 &&
        rect.bottom <= stageRect.bottom + 1;
      const overlapsPhoto =
        !!photoRect &&
        rect.right > photoRect.left &&
        rect.left < photoRect.right &&
        rect.bottom > photoRect.top &&
        rect.top < photoRect.bottom;

      return {
        tone: name.getAttribute("data-hero-name-tone"),
        withinStage: within,
        overlapsPhoto,
        insideCarouselViewport: Boolean(carouselViewport),
        stageBackground: stage ? getComputedStyle(stage).backgroundColor : "",
        photoBackground: carouselPhoto
          ? getComputedStyle(carouselPhoto).backgroundColor
          : singlePhoto
            ? getComputedStyle(singlePhoto).backgroundColor
            : "",
        carouselObjectFit: carouselImage
          ? getComputedStyle(carouselImage).objectFit
          : "",
        bodyBackground,
        paperParts,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
}

test.describe("public-site — HERO名の位置・下地・明暗", () => {
  test("全5種類をPC/スマホとライト/ダークで測る", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop" &&
        testInfo.project.name !== "mobile-touch",
      "PC幅と実タッチ端末相当で測る",
    );
    const runtimeProblems = collectPageRuntimeProblems(page);

    for (const scenario of HERO_NAME_CASES) {
      await page.unrouteAll({ behavior: "wait" });
      const apiMocks = await installPublicApiMocks(page, {
        ...SYNTHETIC_SETTINGS,
        heroMode: scenario.heroMode,
        heroDisplayMode: scenario.heroDisplayMode,
        heroTitlePosition: "top-right",
        profileNameKata: "シンセティック",
        heroNameColor: "#404040",
        heroNameEnColor: "#404040",
        heroSubColor: "#404040",
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(
        page.locator('main h1[data-hero-name-part="primary"]'),
      ).toBeVisible();

      for (const theme of LANGUAGE_SWITCH_THEMES) {
        await setPublicTheme(page, theme);
        await expect
          .poll(async () => {
            const measured = await measureHeroName(page);
            return measured.tone === "on-paper"
              ? Math.min(...measured.paperParts.map((part) => part.ratio))
              : 4.5;
          })
          .toBeGreaterThanOrEqual(4.5);

        const measured = await measureHeroName(page);
        expect(measured.tone, scenario.label).toBe(scenario.tone);
        expect(measured.withinStage, scenario.label).toBe(true);
        expect(measured.scrollWidth, scenario.label).toBe(
          measured.viewportWidth,
        );

        if (scenario.tone === "over-photo") {
          expect(measured.overlapsPhoto, scenario.label).toBe(true);
        }
        if (scenario.label === "carousel normal") {
          expect(measured.insideCarouselViewport).toBe(false);
          expect(measured.stageBackground).toBe("rgba(0, 0, 0, 0)");
          expect(measured.photoBackground).toBe("rgb(11, 11, 11)");
          expect(measured.carouselObjectFit).toBe("contain");
        }
        if (scenario.label === "carousel fullscreen") {
          expect(measured.insideCarouselViewport).toBe(true);
          expect(measured.photoBackground).toBe("rgb(11, 11, 11)");
          expect(measured.carouselObjectFit).toBe("cover");
        }
        if (scenario.label === "single") {
          expect(measured.stageBackground).toBe("rgba(0, 0, 0, 0)");
          expect(measured.photoBackground).toBe("rgb(11, 11, 11)");
        }
      }

      expect(apiMocks.unexpectedRequests, scenario.label).toEqual([]);
    }

    expect(runtimeProblems).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-12: 公開About/ContactのJP|ENは、文字だけではなく実際に押せる面を
// 測る。DOMの文字矩形は小さいままでよいが、タッチ端末ではその中央を含む32px
// 四方が同じリンクへ連続して届かなければならない。
// ─────────────────────────────────────────────────────────────────────────────
test.describe("public-site — JP/EN切替の実タップ領域", () => {
  test.describe("390px DPR3 touch", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });

    /**
     * **Work の棚に1本入れたら、ナビが1つ増える。**
     *
     * 2026-08-30 に Work を足したとき、モックが `?kind=work` にも同じ中身を
     * 返していたせいで「Work が2本ある」状態になり、390px で JP/EN の当たり面が
     * **0 に潰れた**。モックの誤りだったが、**実際に Work を入れれば同じ幅に
     * なる。** 誤りを直して終わりにせず、本当に入れた状態でも壊れないことを
     * ここで確かめる。
     */
    test("Work をナビに足しても、JP/EN の当たり面と横幅は保たれる", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile-touch",
        "実端末相当のpointer: coarseだけで当たり面を測る",
      );
      const runtimeProblems = collectPageRuntimeProblems(page);
      const apiMocks = await installPublicApiMocks(page, SYNTHETIC_SETTINGS, [
        { ...SYNTHETIC_SERIES[0], id: 9001, slug: "commissions", title: "Commissions" },
      ]);

      await page.goto("/about", { waitUntil: "domcontentloaded" });
      await expect(page.locator(".language-switch:visible")).toBeVisible();
      // Work がナビに出ていること（この前提が崩れたらテストの意味が無い）。
      // ヘッダーは横並びとハンバーガーの**両方**にリンクを持つので数は1では
      // ない。「1つ以上ある」で見る。
      expect(
        await page.locator('header a[href="/work"]').count(),
      ).toBeGreaterThan(0);
      await openMobileLanguageSwitch(page);

      const hitArea = await measureLanguageSwitchHitArea(page, "/en/about");
      expect(hitArea.horizontalContinuousHit).toBeGreaterThanOrEqual(32);
      expect(hitArea.verticalContinuousHit).toBeGreaterThanOrEqual(32);
      expect(hitArea.full32pxSquare).toBe(true);

      expect(
        await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })),
      ).toEqual({ scrollWidth: 390, viewportWidth: 390 });

      expect(apiMocks.unexpectedRequests).toEqual([]);
      expect(runtimeProblems).toEqual([]);
    });

    test("About/Contactの両方向は明暗とも32px以上で、中央タップが相手言語へ進む", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile-touch",
        "実端末相当のpointer: coarseだけで当たり面を測る",
      );
      const runtimeProblems = collectPageRuntimeProblems(page);
      const apiMocks = await installPublicApiMocks(page);

      await expect
        .poll(() =>
          page.evaluate(() => ({
            dpr: window.devicePixelRatio,
            pointerCoarse: matchMedia("(pointer: coarse)").matches,
          })),
        )
        .toEqual({ dpr: 3, pointerCoarse: true });

      for (const theme of LANGUAGE_SWITCH_THEMES) {
        for (const scenario of LANGUAGE_SWITCH_CASES) {
          await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
          await expect(page.locator(".language-switch:visible")).toBeVisible();
          await setPublicTheme(page, theme);
          await openMobileLanguageSwitch(page);

          const languageSwitch = page.locator(".language-switch:visible");
          const currentLanguage = languageSwitch.locator(
            '[aria-current="page"]',
          );
          await expect(currentLanguage).toHaveCount(1);
          await expect(currentLanguage).toHaveText(scenario.currentLanguage);
          expect(await currentLanguage.evaluate((element) => element.tagName)).toBe(
            "SPAN",
          );

          const languageLink = languageSwitch.locator(
            `a[href="${scenario.destination}"]`,
          );
          await expect(languageLink).toHaveAttribute("href", scenario.destination);
          const hitArea = await measureLanguageSwitchHitArea(
            page,
            scenario.destination,
          );
          // The text remains the original compact editorial size; only the
          // transparent child expands what receives a real pointer event.
          expect(hitArea.visual.width).toBeLessThan(24);
          expect(hitArea.visual.height).toBeLessThan(24);
          expect(hitArea.hit).toMatchObject({
            width: 32,
            height: 32,
            position: "absolute",
          });
          expect(hitArea.horizontalContinuousHit).toBeGreaterThanOrEqual(32);
          expect(hitArea.verticalContinuousHit).toBeGreaterThanOrEqual(32);
          expect(hitArea.full32pxSquare).toBe(true);

          if (scenario.path === "/about") {
            await expectLanguageSwitchKeyboardFocus(page, scenario.destination);
          }

          expect(
            await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              viewportWidth: window.innerWidth,
            })),
          ).toMatchObject({ scrollWidth: 390, viewportWidth: 390 });

          await page.touchscreen.tap(hitArea.center.x, hitArea.center.y);
          await expect(page).toHaveURL(
            new RegExp(`${scenario.destination.replaceAll("/", "\\/")}$`),
          );
        }
      }

      expect(apiMocks.unexpectedRequests).toEqual([]);
      expect(runtimeProblems).toEqual([]);
    });
  });

  test("desktopの全nav効果でも文字位置を変えず、装飾と32pxの当たり面を保つ", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "hover効果はdesktopで確認する",
    );
    const runtimeProblems = collectPageRuntimeProblems(page);
    const apiMocks = [] as PublicApiMocks[];

    for (const theme of LANGUAGE_SWITCH_THEMES) {
      for (const navHoverEffect of ["fade", "underline", "dot", "blur"] as const) {
        apiMocks.push(
          await installPublicApiMocks(page, {
            ...SYNTHETIC_SETTINGS,
            navHoverEffect,
          }),
        );
        await page.goto("/about", { waitUntil: "domcontentloaded" });
        await expect(page.locator(`.nav-fx-${navHoverEffect}`)).toBeVisible();
        await expect(page.locator(".language-switch:visible")).toBeVisible();
        await setPublicTheme(page, theme);

        const languageLink = page.locator(
          '.language-switch a[href="/en/about"]:visible',
        );
        const hitArea = await measureLanguageSwitchHitArea(page, "/en/about");
        expect(hitArea.visual.width).toBeLessThan(24);
        expect(hitArea.visual.height).toBeLessThan(24);
        expect(hitArea.hit).toMatchObject({ width: 32, height: 32 });

        await languageLink.hover();
        await page.waitForTimeout(250);
        const effect = await languageLink.evaluate((element) => {
          const before = getComputedStyle(element, "::before");
          const after = getComputedStyle(element, "::after");
          const style = getComputedStyle(element);
          return {
            beforeOpacity: before.opacity,
            afterDisplay: after.display,
            afterTransform: after.transform,
            animationName: style.animationName,
          };
        });

        if (navHoverEffect === "dot") {
          expect(Number.parseFloat(effect.beforeOpacity)).toBeGreaterThan(0.95);
          expect(effect.afterDisplay).toBe("none");
        } else if (navHoverEffect === "blur") {
          expect(effect.afterDisplay).toBe("none");
          expect(effect.animationName).toContain("nav-blur-in");
        } else {
          const underlineScale = Number.parseFloat(
            effect.afterTransform.match(/^matrix\(([^,]+)/)?.[1] ?? "0",
          );
          expect(underlineScale).toBeGreaterThan(0.95);
        }

        const width = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(width.scrollWidth).toBeLessThanOrEqual(width.viewportWidth);
      }
    }

    expect(apiMocks.flatMap((mocks) => mocks.unexpectedRequests)).toEqual([]);
    expect(runtimeProblems).toEqual([]);
  });
});

test.describe("public-site — generated thumbnail density", () => {
  test.describe("390px DPR3", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });

    test("under-dense panorama alone upgrades to static medium without a proxy request", async ({
      page,
    }) => {
      const runtimeProblems = collectPageRuntimeProblems(page);
      const apiMocks = await installSelectiveDensityMocks(page);
      const allImageRequests: string[] = [];
      page.on("request", (request) => {
        if (request.resourceType() === "image") {
          allImageRequests.push(request.url());
        }
      });

      await page.goto("/gallery");
      await expect(page.locator("main .photo-card img")).toHaveCount(3);
      await expect
        .poll(async () => {
          const images = await densityImageState(page);
          return (
            images.length === 3 &&
            images[0]?.currentSrc.endsWith("/medium-pano.svg") === true &&
            images[1]?.currentSrc.endsWith("/thumb-landscape.svg") === true &&
            images[2]?.currentSrc.endsWith("/thumb-portrait.svg") === true
          );
        })
        .toBe(true);

      const images = await densityImageState(page);
      expect(images.map((image) => image.dataSrc)).toEqual([null, null, null]);
      expect(images.map((image) => image.dataSrcset)).toEqual([
        null,
        null,
        null,
      ]);
      expect(images[0]).toMatchObject({
        naturalWidth: 1920,
        naturalHeight: 817,
      });
      expect(images[1]).toMatchObject({ naturalWidth: 640, naturalHeight: 450 });
      expect(images[2]).toMatchObject({ naturalWidth: 640, naturalHeight: 910 });
      expect(images.every((image) => image.clientWidth > 0 && image.clientHeight > 0)).toBe(
        true,
      );
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(3);
      expect(
        new Set(
          apiMocks.imageRequests.filter((name) => name.startsWith("medium-")),
        ),
      ).toEqual(new Set(["medium-pano.svg"]));
      expect(
        new Set(
          apiMocks.imageRequests.filter((name) => name.startsWith("thumb-")),
        ),
      ).toEqual(
        new Set([
          "thumb-pano.svg",
          "thumb-landscape.svg",
          "thumb-portrait.svg",
        ]),
      );
      expect(
        allImageRequests.filter((url) =>
          new URL(url).pathname.includes("/api/images/photos/"),
        ),
      ).toEqual([]);
      expect(
        await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })),
      ).toMatchObject({ scrollWidth: 390, viewportWidth: 390 });
      expect(apiMocks.unexpectedRequests).toEqual([]);
      expect(runtimeProblems).toEqual([]);
    });
  });

  test.describe("390px DPR1", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });

    test("the same panorama remains on its thumbnail and requests no medium", async ({
      page,
    }) => {
      const runtimeProblems = collectPageRuntimeProblems(page);
      const apiMocks = await installSelectiveDensityMocks(page);
      const allImageRequests: string[] = [];
      page.on("request", (request) => {
        if (request.resourceType() === "image") {
          allImageRequests.push(request.url());
        }
      });

      await page.goto("/gallery");
      await expect(page.locator("main .photo-card img")).toHaveCount(3);
      await expect
        .poll(async () => {
          const images = await densityImageState(page);
          return (
            images.length === 3 &&
            images.every(
              (image) =>
                image.complete &&
                image.naturalWidth > 0 &&
                image.currentSrc.includes("/thumb-"),
            )
          );
        })
        .toBe(true);

      const images = await densityImageState(page);
      expect(images.map((image) => image.naturalWidth)).toEqual([640, 640, 640]);
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
      expect(
        apiMocks.imageRequests.filter((name) => name.startsWith("medium-")),
      ).toEqual([]);
      expect(
        new Set(
          apiMocks.imageRequests.filter((name) => name.startsWith("thumb-")),
        ),
      ).toEqual(
        new Set([
          "thumb-pano.svg",
          "thumb-landscape.svg",
          "thumb-portrait.svg",
        ]),
      );
      expect(
        allImageRequests.filter((url) =>
          new URL(url).pathname.includes("/api/images/photos/"),
        ),
      ).toEqual([]);
      expect(
        await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })),
      ).toMatchObject({ scrollWidth: 390, viewportWidth: 390 });
      expect(apiMocks.unexpectedRequests).toEqual([]);
      expect(runtimeProblems).toEqual([]);
    });
  });
});

test.describe("public-site — 横スクロール検査", () => {
  for (const { pages, settings } of [
    { pages: PUBLIC_PAGES, settings: SYNTHETIC_SETTINGS },
    { pages: SERVICE_PAGES, settings: SYNTHETIC_SERVICE_SETTINGS },
  ]) {
    for (const publicPage of pages) {
      for (const width of VIEWPORT_WIDTHS) {
        test(`${publicPage.label} ${publicPage.path} — ${width}pxで横スクロールなし`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          const runtimeProblems = collectPageRuntimeProblems(page);
          const apiMocks = await installPublicApiMocks(page, settings);

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

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-05: 「設定しても反映されない」の再発防止（CSS カスケード編）。
//
// `.nav-pos-left > header > nav ul a:not([aria-current])` が literal な alpha を
// `!important` で当てていたため、admin の「ナビの濃さ」(navOpacity) は左サイド
// バーのサイトで**どの値にしても効かなかった**。jsdom では実 CSS のカスケード
// を再現できないので、ここ（実ブラウザ）で見張る。
// ─────────────────────────────────────────────────────────────────────────────
test.describe("公開サイト — 設定がCSSカスケードに勝てているか", () => {
  for (const navPosition of ["left", "top"] as const) {
    test(`navPosition=${navPosition} で navOpacity がナビの色に届く`, async ({
      page,
    }) => {
      const navColor = () =>
        page.evaluate(() => {
          const link = Array.from(document.querySelectorAll("nav a")).find(
            (el) =>
              /Gallery/.test(el.textContent ?? "") &&
              el.getAttribute("aria-current") !== "page",
          );
          return link ? getComputedStyle(link).color : null;
        });
      // 色には transition が乗っているので、落ち着くまで待ってから読む。
      // 待たずに読むと遷移途中の値(0.4→0.15 の途中など)を掴む。
      const readNavColor = async (navOpacity: string, expected: RegExp) => {
        await installPublicApiMocks(page, {
          ...SYNTHETIC_SETTINGS,
          navPosition,
          navOpacity,
        });
        await page.goto("/");
        await page.waitForSelector("nav a");
        await expect
          .poll(navColor, {
            message: `navOpacity=${navOpacity} がナビの色に届いていない`,
          })
          .toMatch(expected);
        return navColor();
      };

      // 薄い/濃いで実際に別の色になること。同じなら設定が届いていない。
      const faint = await readNavColor("0.15", /0\.15\)$/);
      // alpha 1 は rgb() 表記に畳まれる
      const solid = await readNavColor("1", /^rgb\(/);
      expect(faint, "navOpacity が色に反映されていない").not.toBe(solid);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-05: /gallery で写真が「灰色のまま出ない」件の再発防止。
//
// useScrollFadeIn は effect 実行時点の `.fade-in-item` しか
// IntersectionObserver に渡していなかった。遅れて追加されたタイル
// (PhotoGallery が ResizeObserver で幅を得てから組み直す・無限スクロールの
// 追加分)は誰にも監視されず、opacity 0 のまま永久に残っていた。実測で
// 連続スクロール1往復後に 268/348 枚が出ないところまで再現した。
//
// smoke の合成写真は18枚しかなく無限スクロールが起きないので、ページ全体では
// なく「後から挿入されたタイルが必ず現れる」という仕組みそのものを見る。
// ─────────────────────────────────────────────────────────────────────────────
test.describe("公開サイト — 遅れて現れる写真タイル", () => {
  test("/gallery — effect の後に挿入されたタイルも必ず表示される", async ({
    page,
  }) => {
    const apiMocks = await installPublicApiMocks(page);
    await page.goto("/gallery");
    await page.waitForSelector("main .photo-card");

    const result = await page.evaluate(async () => {
      const container = document.querySelector("main .photo-card")?.parentElement;
      if (!container) return { error: "no gallery container" };
      const make = (id: string) => {
        const el = document.createElement("div");
        el.id = id;
        el.className = "photo-card fade-in-item";
        el.style.height = "200px";
        return el;
      };
      // (1) 画面内に後から挿入 → IntersectionObserver 経由で出るはず
      const inView = make("probe-in-view");
      container.appendChild(inView);
      // (2) スクロール位置より上に挿入 → 交差イベントは二度と来ないので、
      //     即座に見せる経路が要る
      window.scrollTo(0, 0);
      const above = make("probe-above");
      above.style.position = "absolute";
      above.style.top = "-4000px";
      container.appendChild(above);

      await new Promise((r) => setTimeout(r, 1500));
      return {
        inView: inView.classList.contains("visible"),
        above: above.classList.contains("visible"),
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.inView, "後から挿入されたタイルが監視されていない").toBe(true);
    expect(
      result.above,
      "スクロール位置より上に挿入されたタイルが永久に出ない",
    ).toBe(true);
    expect(apiMocks.unexpectedRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-05: ブラウザの「戻る」で URL だけ変わって中身が変わらない件。
//
// PageTransition の遷移エフェクトは `children` を依存配列に入れていたため、
// フェード中にルーターが次のページを渡すと cleanup がタイマーを消し、再実行時は
// `location === prevLocation.current` で早期 return して**組み直さなかった**。
// `transitioning` が true のまま残るのでフォールバックも効かない。
// 実測: /gallery → About → 戻る で、アドレスバーは /gallery、画面は About の
// まま、写真は0枚。戻るを使う人には「ギャラリーが真っ白」に見える。
// ─────────────────────────────────────────────────────────────────────────────
test.describe("公開サイト — 戻る/進むで中身が追従するか", () => {
  test("戻るとURLだけでなく画面もそのページになる", async ({ page }) => {
    const apiMocks = await installPublicApiMocks(page);
    await page.goto("/gallery");
    await page.waitForSelector("main .photo-card");

    // On phone widths the nav links live in the collapsed menu.
    const burger = page.locator('button[aria-controls="mobile-menu"]');
    if (await burger.isVisible()) await burger.click();
    await page.getByRole("link", { name: "About", exact: true }).first().click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator("main")).toContainText(/PROFILE|About/i);

    await page.goBack();
    await expect(page).toHaveURL(/\/gallery$/);
    // The real defect: the address bar said /gallery while About stayed on screen.
    await expect(
      page.locator("main .photo-card").first(),
      "戻った先が /gallery なのに写真が1枚も出ていない",
    ).toBeVisible({ timeout: 10_000 });

    await page.goForward();
    await expect(page).toHaveURL(/\/about$/);
    await expect(
      page.locator("main"),
      "進むでURLは/aboutなのに中身がGalleryのまま",
    ).toContainText(/PROFILE|About/i);

    expect(apiMocks.unexpectedRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-05: 操作まわりの取りこぼし2件。
// - モバイルメニューに Escape が無かった。開いたら、ハンバーガーを押し直すか
//   行き先を選ぶまで閉じられない（他の閉じられる面はすべて Escape で閉じる）。
// - 「上へ戻る」は左サイドバー/下ナビの真下に置かれ、header が z-50 に対して
//   z-40 なので、見えているのにクリックできなかった。
// ─────────────────────────────────────────────────────────────────────────────
test.describe("公開サイト — 閉じる・戻るの操作", () => {
  test("モバイルメニューは Escape で閉じる", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "ハンバーガーは狭い画面だけ");
    await installPublicApiMocks(page);
    await page.goto("/");
    const burger = page.locator('button[aria-controls="mobile-menu"]');
    await burger.click();
    await expect(burger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(burger).toHaveAttribute("aria-expanded", "false");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Math.round(
              document.getElementById("mobile-menu")?.getBoundingClientRect()
                .height ?? -1,
            ),
        ),
      )
      .toBe(0);
  });

  for (const navPosition of ["left", "top", "bottom"] as const) {
    test(`navPosition=${navPosition} で「上へ戻る」を実際に押せる`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "サイドバー/下ナビは広い画面のみ");
      await installPublicApiMocks(page, { ...SYNTHETIC_SETTINGS, navPosition });
      await page.goto("/gallery");
      await page.waitForSelector("main .photo-card");
      await page.evaluate(() => window.scrollTo(0, 3000));
      const btn = page.locator(".back-to-top");
      await expect(btn).toBeVisible();
      // The defect was that it rendered and nothing could reach it: the nav sat
      // on top. A plain click() fails on an intercepted control.
      await btn.click({ timeout: 5000 });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(80);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-12: Contact送信のライフサイクル。
//
// 送信中の disabled は React の再描画後にしか効かないため、同じ task 内に
// submit が重なると Formspree へ二重に届く余地があった。ここでは最初の POST を
// 保留したまま requestSubmit を同期的に2回呼び、実際の送信数を1件へ固定する。
// 外部URLは route で遮断するので、この回帰はメール送信も本番書込みも行わない。
// 成功通知・「もう一度送る」のフォーカスも、JA/EN・明暗・desktop/touch の
// 実ブラウザで同時に守る。
// ─────────────────────────────────────────────────────────────────────────────
test.describe("公開サイト — Contact送信の重複防止とフォーカス", () => {
  test("送信は1件だけで、成功通知と再入力へフォーカスが移る", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop" &&
        testInfo.project.name !== "mobile-touch",
      "desktop と実タッチ端末相当だけで送信ライフサイクルを測る",
    );

    const settings = {
      ...SYNTHETIC_SETTINGS,
      formspreeUrl: "https://example.test/synthetic-contact",
      // Empty custom labels exercise Contact's built-in JP/EN fallbacks.
      contactSentMessage: undefined,
      contactSendAnother: undefined,
      contactSendButton: undefined,
      contactSendingButton: undefined,
    };
    const apiMocks = await installPublicApiMocks(page, settings);

    let posts = 0;
    let responseStatus = 200;
    let releaseFirstPost = () => {};
    let firstPostPending = Promise.resolve();
    await page.route("https://example.test/**", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      posts += 1;
      if (posts === 1) await firstPostPending;
      await route.fulfill({
        status: responseStatus,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    for (const theme of LANGUAGE_SWITCH_THEMES) {
      for (const [language, path] of [
        ["ja", "/contact"],
        ["en", "/en/contact"],
      ] as const) {
        posts = 0;
        responseStatus = 200;
        firstPostPending = new Promise<void>((resolve) => {
          releaseFirstPost = resolve;
        });

        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("form")).toBeVisible();
        await setPublicTheme(page, theme);
        await page.locator("#contact-name").fill(`Smoke ${language}`);
        await page.locator("#contact-email").fill("smoke@example.test");
        await page.locator("#contact-message").fill("Read-only contact smoke");

        // Both submit events run before React can render the disabled button.
        // The synchronous ref lock must still leave exactly one POST in flight.
        await page.evaluate(() => {
          const form = document.querySelector("form");
          if (!form) throw new Error("Contact form is missing");
          form.requestSubmit();
          form.requestSubmit();
        });
        await expect.poll(() => posts).toBe(1);
        await expect(page.locator('button[type="submit"]')).toBeDisabled();
        await expect(page.locator('button[type="submit"]')).toHaveAttribute(
          "aria-busy",
          "true",
        );
        await expect(page.locator('button[type="submit"]')).toHaveText(
          "Sending...",
        );

        releaseFirstPost();
        await expect(page.locator('p[aria-live="polite"]')).toHaveText(
          language === "ja"
            ? "送信しました。"
            : "Thank you. Your message has been sent.",
        );
        await expect.poll(() => posts).toBe(1);
        await expect
          .poll(() =>
            page.evaluate(() => ({
              activeIsLiveRegion:
                document.activeElement?.getAttribute("aria-live") === "polite",
              activeTabIndex: (document.activeElement as HTMLElement | null)?.tabIndex,
              scrollWidth: document.documentElement.scrollWidth,
              viewportWidth: window.innerWidth,
            })),
          )
          .toEqual({
            activeIsLiveRegion: true,
            activeTabIndex: -1,
            scrollWidth: await page.evaluate(() => window.innerWidth),
            viewportWidth: await page.evaluate(() => window.innerWidth),
          });

        await page
          .getByRole("button", { name: "Send another" })
          .click();
        await expect(page.locator("#contact-name")).toBeFocused();
        await expect(page.locator('button[type="submit"]')).toBeEnabled();

        // The request lock must be released after a failed response so the
        // visitor can correct or resend without refreshing the page.
        await page.locator("#contact-name").fill(`Retry ${language}`);
        await page.locator("#contact-email").fill("retry@example.test");
        await page.locator("#contact-message").fill("Retry after an error");
        responseStatus = 500;
        await page.evaluate(() => {
          const form = document.querySelector("form");
          if (!form) throw new Error("Contact form is missing after retry view");
          form.requestSubmit();
        });
        await expect.poll(() => posts).toBe(2);
        await expect(page.locator('[role="alert"]')).toBeVisible();
        // 失敗の一文そのものを指して測る。alert の中には、繰り返しても直らない
        // 失敗のための逃げ道（設定済みメールへの mailto）も入るため、alert 全体
        // の文字列で比べると、その付け足しだけで落ちてしまう。
        await expect(page.locator("[data-contact-error]")).toHaveText(
          language === "ja"
            ? "送信できませんでした。もう一度お試しください。"
            : "Failed to send. Please try again.",
        );
        await expect(page.locator('button[type="submit"]')).toBeEnabled();

        responseStatus = 200;
        await page.evaluate(() => {
          const form = document.querySelector("form");
          if (!form) throw new Error("Contact form is missing for final retry");
          form.requestSubmit();
        });
        await expect.poll(() => posts).toBe(3);
        await expect(page.locator('p[aria-live="polite"]')).toHaveText(
          language === "ja"
            ? "送信しました。"
            : "Thank you. Your message has been sent.",
        );
        await expect
          .poll(() =>
            page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              viewportWidth: window.innerWidth,
            })),
          )
          .toEqual({
            scrollWidth: await page.evaluate(() => window.innerWidth),
            viewportWidth: await page.evaluate(() => window.innerWidth),
          });
      }
    }

    expect(apiMocks.unexpectedRequests).toEqual([]);
  });
});
