import { expect, test, type Page, type Route } from "@playwright/test";

type MockImageBehavior = {
  failMediumOnce?: Set<number>;
  mediumDelayMs?: Map<number, number>;
};

type PublicApiMocks = {
  nonGetRequests: string[];
  imageRequests: string[];
};

type SyntheticPhoto = {
  id: number;
  filename: string;
  url: string;
  thumbUrl: string;
  mediumUrl: string;
  title: string;
  meta: string;
  description: string;
  category: string;
  camera: string | null;
  lens: string | null;
  focalLength: number | null;
  fNumber: string | null;
  exposureTime: string | null;
  iso: string | null;
  filmType: "デジタル" | "フィルム";
  shotAt: string | null;
  displaySize: "S" | "M" | "L";
  width: number;
  height: number;
  rotationDeg: 0;
  focalX: number;
  focalY: number;
  sortOrder: number;
  seriesId: number | null;
  isPublished: true;
  fileHash: null;
  deletedAt: null;
  createdAt: string;
};

type SyntheticSeries = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  statement: string;
  coverPhotoId: number;
  coverUrl: string;
  coverRotationDeg: 0;
  coverFocalX: number;
  coverFocalY: number;
  sortOrder: number;
  isPublished: true;
  themeConfig: null;
};

const SOLID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVR42u3PQQkAAAgEsEtsAxsY2gi+hcEKLNXzWgQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQELgtzg3Fa6mxyjAAAAABJRU5ErkJggg==",
  "base64",
);

const SYNTHETIC_SETTINGS = {
  siteName: "Synthetic Photo Studio",
  siteNameEn: "Synthetic Photo Studio",
  heroSubtitle: "Artificial portfolio smoke fixtures",
  heroMode: "single",
  heroDisplayMode: "normal",
  publicExperience: "photo-app",
  topWorksMode: "auto",
  gallerySortOrder: "manual",
  homeGalleryCount: "18",
  topWorksIds: "",
  galleryLayout: "clean-grid",
  galleryColumns: "5",
  galleryGapScale: "1",
  gallerySizeVariation: "0",
  galleryExcludeSeries: "off",
  seriesNavEnabled: "on",
  workNavEnabled: "off",
  seriesSortOrder: "manual",
  navPosition: "left",
  navOpacity: "0.85",
  navLabelWork: "Works",
  profileLabel: "About",
  profileName: "Synthetic Photographer",
  profileNameEn: "Synthetic Photographer",
  profileBio: "Artificial profile content for smoke verification.",
  profileBioEn: "Artificial profile content for smoke verification.",
  profilePhotoUrl: "/api/images/photos/original/10001.png",
  profileInstagram: "https://example.test/synthetic-instagram",
  profileTwitter: "https://example.test/synthetic-twitter",
  profileNote: "https://example.test/synthetic-note",
  noteEnabled: "on",
  noteUsername: "synthetic-note",
  noteShowCount: "2",
  contactLabel: "Contact",
  contactIntro: "Artificial contact copy for verification.",
  contactIntroEn: "Artificial contact copy for verification.",
  contactEmail: "synthetic@example.test",
  formspreeUrl: "https://example.test/synthetic-contact",
  servicePageMode: "off",
  footerCtaLabel: "Contact",
};

const SYNTHETIC_CATEGORIES = [
  { id: 12_001_001, slug: "synthetic-people", label: "Synthetic People", sortOrder: 0 },
  { id: 12_001_002, slug: "synthetic-places", label: "Synthetic Places", sortOrder: 1 },
];

const SYNTHETIC_SERIES = [
  {
    id: 12_002_001,
    slug: "synthetic-series-one",
    title: "Synthetic Series One",
    subtitle: "Portrait / place study",
    statement: "Fixture-only series detail used by smoke checks.",
    coverPhotoId: 10_001,
    coverUrl: "/api/images/photos/thumb/10001.png",
    coverRotationDeg: 0,
    coverFocalX: 50,
    coverFocalY: 50,
    sortOrder: 0,
    isPublished: true,
    themeConfig: null,
  } satisfies SyntheticSeries,
  {
    id: 12_002_002,
    slug: "synthetic-series-two",
    title: "Synthetic Series Two",
    subtitle: "Another fixture set",
    statement: "Second series fixture for shelf and route coverage.",
    coverPhotoId: 10_015,
    coverUrl: "/api/images/photos/thumb/10015.png",
    coverRotationDeg: 0,
    coverFocalX: 50,
    coverFocalY: 50,
    sortOrder: 1,
    isPublished: true,
    themeConfig: null,
  } satisfies SyntheticSeries,
];

const SYNTHETIC_WORKS = [
  {
    id: 12_003_001,
    slug: "synthetic-work-one",
    title: "Synthetic Work One",
    subtitle: "Commission-style fixture",
    statement: "Work shelf fixture for query `kind=work`.",
    coverPhotoId: 10_021,
    coverUrl: "/api/images/photos/thumb/10021.png",
    coverRotationDeg: 0,
    coverFocalX: 50,
    coverFocalY: 50,
    sortOrder: 0,
    isPublished: true,
    themeConfig: null,
  } satisfies SyntheticSeries,
];

const SYNTHETIC_NOTE_POSTS = [
  {
    title: "Synthetic journal entry",
    link: "https://example.test/synthetic-journal-entry",
    date: "2026-09-01",
    excerpt: "Fixture data used only in smoke tests.",
    thumbnail: "/api/images/photos/thumb/10030.png",
  },
];

const SYNTHETIC_PHOTOS: SyntheticPhoto[] = Array.from(
  { length: 428 },
  (_, index) => {
    const id = 10_001 + index;
    const portrait = index % 2 === 1;
    return {
      id,
      filename: `synthetic-photo-${id}.png`,
      url: `/api/images/photos/original/${id}.png`,
      thumbUrl: `/api/images/photos/thumb/${id}.png`,
      mediumUrl: `/api/images/photos/medium/${id}.png`,
      title: `Synthetic photo ${id}`,
      meta: `fixture-${index}`,
      description: portrait ? "Portrait fixture" : "Landscape fixture",
      category: index % 3 === 0 ? "synthetic-people" : "synthetic-places",
      camera: null,
      lens: null,
      focalLength: null,
      fNumber: null,
      exposureTime: null,
      iso: null,
      filmType: index % 2 === 0 ? "デジタル" : "フィルム",
      shotAt: "2026-01-01",
      displaySize: ["S", "M", "L"][index % 3] as "S" | "M" | "L",
      width: portrait ? 1200 : 1800,
      height: portrait ? 1800 : 1200,
      rotationDeg: 0,
      focalX: 50,
      focalY: 50,
      sortOrder: index,
      seriesId: index < 20 ? 12_002_001 : index < 50 ? 12_002_002 : null,
      isPublished: true,
      fileHash: null,
      deletedAt: null,
      createdAt: "2026-09-08T00:00:00.000Z",
    };
  },
);

function getPhotoIndexById(id: number): number {
  return SYNTHETIC_PHOTOS.findIndex((photo) => photo.id === id);
}

function parsePhotoImage(pathname: string):
  | { type: "thumb" | "medium" | "original"; id: number }
  | null {
  const match = /\/api\/images\/photos\/(thumb|medium|original)\/(\d+)\.png/.exec(
    pathname,
  );
  if (!match) return null;
  return {
    type: match[1] as "thumb" | "medium" | "original",
    id: Number.parseInt(match[2], 10),
  };
}

function extractBgAlpha(cssColor: string): number | null {
  if (cssColor.startsWith("rgba")) {
    const match = cssColor.match(/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([^)]+)\)$/);
    if (!match) return null;
    const alpha = Number.parseFloat(match[1] ?? "1");
    return Number.isNaN(alpha) ? null : alpha;
  }
  if (cssColor.startsWith("rgb")) return 1;
  return null;
}

async function fulfillJson(route: Route, value: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(value),
  });
}

async function fulfillImage(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "image/png",
    body: SOLID_PNG,
  });
}

async function installPhotoAppApiMocks(
  page: Page,
  settings = SYNTHETIC_SETTINGS,
  imageBehavior: MockImageBehavior = {},
): Promise<PublicApiMocks> {
  const nonGetRequests: string[] = [];
  const imageRequests: string[] = [];
  const mediumErrorCount: Record<number, number> = {};

  const guard = async (route: Route): Promise<void> => {
    const request = route.request();
    const method = request.method();
    if (method !== "GET" && method !== "HEAD") {
      nonGetRequests.push(`${method} ${request.url()}`);
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "unexpected request in smoke" }),
      });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unmocked read blocked" }) });
  };

  const registerGetApi = async (
    pattern: string | RegExp,
    handler: (route: Route) => Promise<void>,
  ) => {
    await page.route(pattern, async (route) => {
      const method = route.request().method();
      if (method !== "GET" && method !== "HEAD") {
        nonGetRequests.push(`${method} ${route.request().url()}`);
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "unexpected request in smoke" }),
        });
        return;
      }
      await handler(route);
    });
  };

  await page.route("**/api/**", guard);
  await registerGetApi("**/api/settings**", (route) => fulfillJson(route, settings));
  await registerGetApi("**/api/photos**", (route) =>
    fulfillJson(route, { photos: SYNTHETIC_PHOTOS }),
  );
  await registerGetApi("**/api/hero-photos**", (route) =>
    fulfillJson(route, { heroPhotos: SYNTHETIC_PHOTOS.slice(0, 3) }),
  );
  await registerGetApi(/\/.+\/api\/series(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get("kind");
    return fulfillJson(route, {
      series: kind === "work" ? SYNTHETIC_WORKS : SYNTHETIC_SERIES,
    });
  });
  await registerGetApi(/\/.+\/api\/series\/[^/?]+(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const slug = request.url().split("/api/series/")[1]?.split("?")[0] ?? "";
    const matched = [...SYNTHETIC_SERIES, ...SYNTHETIC_WORKS].find(
      (series) => series.slug === slug,
    );
    if (!matched) {
      await fulfillJson(route, { error: "not found" }, 404);
      return;
    }
    return fulfillJson(route, {
      series: matched,
      photos: SYNTHETIC_PHOTOS.filter((photo) => photo.seriesId === matched.id),
    });
  });
  await registerGetApi("**/api/categories**", (route) =>
    fulfillJson(route, { categories: SYNTHETIC_CATEGORIES }),
  );
  await registerGetApi("**/api/note-posts**", (route) =>
    fulfillJson(route, { posts: SYNTHETIC_NOTE_POSTS }),
  );
  await registerGetApi("**/api/pricing**", (route) =>
    fulfillJson(route, { plans: [] }),
  );

  await registerGetApi("**/api/images/**", async (route) => {
    const request = route.request();
    const parsed = parsePhotoImage(new URL(request.url()).pathname);
    const imageUrl = request.url();
    imageRequests.push(imageUrl);
    const delay =
      parsed?.type === "medium"
        ? imageBehavior.mediumDelayMs?.get(parsed.id) ?? 0
        : 0;

    if (delay > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }

    if (parsed?.type === "medium" && imageBehavior.failMediumOnce?.has(parsed.id)) {
      const attempts = mediumErrorCount[parsed.id] ?? 0;
      if (attempts === 0) {
        mediumErrorCount[parsed.id] = 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "temporary test failure" }),
        });
        return;
      }
      const url = new URL(request.url());
      if (url.searchParams.has("retry")) {
        await fulfillImage(route);
        return;
      }
    }

    await fulfillImage(route);
  });

  return {
    nonGetRequests,
    imageRequests,
  };
}

async function expectNoUnexpectedMutations(apiMocks: PublicApiMocks) {
  expect(apiMocks.nonGetRequests).toEqual([]);
}

async function waitForPhotoGrid(page: Page) {
  const grid = page.locator(".pa-grid[data-photo-count='428']");
  await expect(grid).toBeVisible();
  await expect(grid.locator("[data-photo-tile]").first()).toBeVisible();
  return grid;
}

async function firstFullyVisiblePhotoId(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>("main.pa-scroll");
    if (!scroller) return null;
    const style = getComputedStyle(scroller);
    const topPad = parseFloat(style.scrollPaddingTop || "0") || 0;
    const bottomPad = parseFloat(style.scrollPaddingBottom || "0") || 0;
    const top = scroller.getBoundingClientRect().top + topPad;
    const bottom = scroller.getBoundingClientRect().bottom - bottomPad;
    const tiles = Array.from(
      document.querySelectorAll<HTMLButtonElement>("main.pa-scroll [data-photo-tile]"),
    );
    for (const tile of tiles) {
      const rect = tile.getBoundingClientRect();
      if (rect.top >= top && rect.bottom <= bottom) {
        const id = Number.parseInt(tile.dataset.photoTile ?? "", 10);
        if (!Number.isNaN(id)) return id;
      }
    }
    return null;
  });
}

function extractPhotoIdFromPath(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    const photo = params.get("photo");
    if (!photo) return null;
    const value = Number.parseInt(photo, 10);
    return Number.isNaN(value) ? null : value;
  });
}

async function runningAnimations(page: Page): Promise<number> {
  return page.evaluate(() =>
    document.getAnimations().filter((animation) => animation.playState === "running")
      .length,
  );
}

test("公開ポートフォリオ — 代表写真から拡大して元の表紙へ戻れる", async ({ page }) => {
  const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS);
  await page.goto("/");
  const cover = page.getByRole("button", { name: "代表作品を拡大", exact: true });
  await expect(cover).toBeVisible();
  const scroller = page.locator(".pa-scroll");
  await cover.click();
  await expect(page.getByRole("dialog", { name: "写真ビューア" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cover).toBeFocused();
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(0);
  await expectNoUnexpectedMutations(apiMocks);
});

test("公開PhotoApp — ギャラリー初期描画は428枚・仮想DOM・サムネイルのみ最初に要求", async ({
  page,
}) => {
  const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS);
  await page.goto("/gallery");

  const grid = await waitForPhotoGrid(page);
  const mounted = await grid.locator("[data-photo-tile]").count();
  expect(mounted, "初期の仮想マウント数").toBeGreaterThan(0);
  expect(mounted, "初期の仮想マウント数").toBeLessThan(120);

  const endNote = page.locator(".pa-end-note");
  await expect(endNote).toContainText("428枚");

  const firstImage = page.locator("main.pa-scroll [data-photo-tile]").first().locator("img");
  await expect.poll(() => firstImage.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);

  expect(
    apiMocks.imageRequests.every((url) => !url.includes("/api/images/photos/medium/")),
    "ギャラリー初期描画でmediumが要求されている",
  ).toBe(true);
  expect(
    apiMocks.imageRequests.every((url) => !url.includes("/api/images/photos/original/")),
    "ギャラリー初期描画でoriginalが要求されている",
  ).toBe(true);

  const firstTile = page
    .locator('main.pa-scroll [data-photo-tile]')
    .first();
  const firstPhotoId = await firstTile.getAttribute("data-photo-tile");
  await firstTile.click();

  const dialog = page.getByRole("dialog", { name: "写真ビューア" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator(".pa-viewer-heading [aria-live='polite']"),
  ).toContainText("428");
  await expect
    .poll(() =>
      apiMocks.imageRequests.some((url) =>
        firstPhotoId ? url.includes(`/api/images/photos/medium/${firstPhotoId}.png`) : false,
      ),
    )
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expectNoUnexpectedMutations(apiMocks);
});

test("公開PhotoApp — 深いスクロールでも仮想DOM件数は有界、密度変更後も視認写真は近傍を維持", async ({
  page,
}) => {
  const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS);
  const scroller = page.locator("main.pa-scroll");
  await page.goto("/gallery");
  await waitForPhotoGrid(page);

  await scroller.evaluate((element) => {
    element.scrollTop = 1500;
  });
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(1500);

  const mounted = await page
    .locator("main.pa-scroll [data-photo-tile]")
    .count();
  expect(mounted).toBeGreaterThan(0);
  expect(mounted).toBeLessThan(120);

  await expect(
    page.locator('main.pa-scroll [data-photo-tile] img').first(),
  ).toBeVisible();

  await expect.poll(() => firstFullyVisiblePhotoId(page)).not.toBeNull();
  const beforePhotoId = await firstFullyVisiblePhotoId(page);
  const beforeColumnsText = await page.locator(".pa-view-tools output").innerText();
  const beforeColumns = Number.parseInt(beforeColumnsText, 10) || 5;

  const densityButton = page.getByRole("button", { name: "写真を小さく" });
  if (await densityButton.isEnabled()) {
    const point = await densityButton.boundingBox();
    if (!point) throw new Error("Density button is not visible");
    // A sticky toolbar is already onscreen; avoid locator autoscroll moving the gallery.
    await page.mouse.click(point.x + point.width / 2, point.y + point.height / 2);
  } else {
    await page.getByRole("button", { name: "写真を大きく" }).click();
  }

  const afterColumnsText = await page.locator(".pa-view-tools output").innerText();
  const afterColumns = Number.parseInt(afterColumnsText, 10) || beforeColumns;
  await expect.poll(() => firstFullyVisiblePhotoId(page)).not.toBeNull();
  const afterPhotoId = await firstFullyVisiblePhotoId(page);

  expect(beforePhotoId).not.toBeNull();
  expect(afterPhotoId).not.toBeNull();
  expect(Math.abs(getPhotoIndexById(afterPhotoId!) - getPhotoIndexById(beforePhotoId!))).toBeLessThanOrEqual(Math.max(beforeColumns, afterColumns) * 2);

  const lastId = SYNTHETIC_PHOTOS.at(-1)?.id;
  if (!lastId) {
    throw new Error("fixture invalid");
  }

  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const lastTile = page.locator(`main.pa-scroll button[data-photo-tile="${lastId}"]`);
  await expect.poll(() => lastTile.count()).toBeGreaterThan(0);
  await expect(page.locator(".pa-end-note")).toBeInViewport();
  await expect(page.locator(".pa-page-footer")).toBeInViewport();
  await expect(page.locator('.pa-page-footer a[href="/contact"]')).toBeVisible();
  await lastTile.first().click();

  const dialog = page.getByRole("dialog", { name: "写真ビューア" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".pa-viewer-heading [aria-live='polite']")).toContainText(
    `${SYNTHETIC_PHOTOS.length}`,
  );

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expectNoUnexpectedMutations(apiMocks);
});

test("公開PhotoApp — スクロール位置を保った写真ビューア遷移と履歴", async ({
  page,
}) => {
  const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS);
  const scroller = page.locator("main.pa-scroll");
  await page.goto("/gallery");
  await waitForPhotoGrid(page);

  await scroller.evaluate((element) => {
    element.scrollTop = 1500;
  });

  const candidateId =
    (await firstFullyVisiblePhotoId(page)) || SYNTHETIC_PHOTOS[40].id;
  await page
    .locator(`main.pa-scroll button[data-photo-tile="${candidateId}"]`)
    .click();

  const dialog = page.getByRole("dialog", { name: "写真ビューア" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".pa-viewer-heading [aria-live='polite']")).toContainText(
    `${SYNTHETIC_PHOTOS.length}`,
  );

  const nextButton = page.getByRole("button", { name: "次の写真" });
  await expect(nextButton).toBeVisible();
  const beforePhoto = await extractPhotoIdFromPath(page);
  await nextButton.click();
  const afterPhoto = await extractPhotoIdFromPath(page);
  expect(beforePhoto).not.toEqual(afterPhoto);

  const infoButton = page.getByRole("button", { name: "写真の情報" });
  await infoButton.click();
  await expect(dialog.locator(".pa-photo-info")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog.locator(".pa-photo-info")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const focusedOnPhoto = await page.evaluate((photoId) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLButtonElement)) return false;
    return active.dataset.photoTile === String(photoId);
  }, afterPhoto);
  expect(focusedOnPhoto).toBe(true);

  await expect.poll(() =>
    page.evaluate((photoId) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLButtonElement)) return false;
      const tileRect = active.getBoundingClientRect();
      const toolbar = document.querySelector<HTMLElement>(".pa-portfolio-header");
      const mobileNav = document.querySelector<HTMLElement>(".pa-controls");

      const overlaps = (a: DOMRect | null, b: DOMRect | null) =>
        !!a &&
        !!b &&
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;

      return (
        active.dataset.photoTile === String(photoId) &&
        !overlaps(tileRect, toolbar ? toolbar.getBoundingClientRect() : null) &&
        !(
          mobileNav &&
          overlaps(tileRect, mobileNav.getBoundingClientRect())
        )
      );
    }, afterPhoto),
  ).toBe(true);

  await page.goForward();
  expect(await extractPhotoIdFromPath(page)).toBe(afterPhoto);
  await page.goBack();
  expect(await extractPhotoIdFromPath(page)).toBeNull();

  await page.goto(`/gallery?photo=${afterPhoto}`);
  await expect(
    page.getByRole("dialog", { name: "写真ビューア" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "写真ビューア" }),
  ).toBeHidden();
  expect(await extractPhotoIdFromPath(page)).toBeNull();

  await expectNoUnexpectedMutations(apiMocks);
});

test("公開PhotoApp — モバイルはボタン遷移とEscape fallbackで確認", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch", "mobile-touchのみに実施");

  const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS);
  await page.goto("/gallery");
  await waitForPhotoGrid(page);

  await page
    .locator("main.pa-scroll [data-photo-tile]")
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "写真ビューア" });
  await expect(dialog).toBeVisible();

  const beforePhoto = await extractPhotoIdFromPath(page);
  await dialog.getByRole("button", { name: "次の写真" }).click();
  const nextPhoto = await extractPhotoIdFromPath(page);
  expect(beforePhoto).not.toBe(nextPhoto);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await extractPhotoIdFromPath(page)).toBeNull();

  await page.goto(`/gallery?photo=${nextPhoto}`);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expectNoUnexpectedMutations(apiMocks);
});

test("公開PhotoApp — 検索と絞り込みはutm/qを保持し、未該当時は解除ボタンで戻る", async ({
  page,
}) => {
  const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS);
  await page.goto("/gallery?utm_source=synthetic");
  await waitForPhotoGrid(page);

  const filterButton = page.getByRole("button", { name: "写真を絞り込む" });
  const searchInput = page.getByRole("searchbox", { name: "写真を検索" });
  if (await searchInput.isHidden()) {
    await page.getByRole("button", { name: "検索を開く" }).click();
  }

  await searchInput.fill("Synthetic");
  await expect(page.locator("main")).toContainText("Synthetic");
  await expect(
    page
      .locator(".pa-view-tools")
      .getByRole("button", { name: "写真を絞り込む" }),
  ).toBeVisible();

  await expect(page).toHaveURL(/utm_source=synthetic/);
  await expect(page).toHaveURL(/q=Synthetic/);

  await filterButton.click();
  await page
    .getByLabel("撮影方式")
    .selectOption("film");
  await page.getByRole("button", { name: "絞り込みを閉じる" }).click();
  await expect(filterButton).toBeFocused();
  await expect(page.locator(".pa-filter-dialog")).toBeHidden();

  const sortSelect = page.getByRole("combobox", { name: "写真の並び順" });
  await sortSelect.selectOption("newest");
  await expect(page).toHaveURL(/sort=newest/);
  await expect(page.locator(".pa-end-note")).toContainText("214");

  await searchInput.fill("non-existent-result");
  await expect(page.locator("main")).toContainText("写真が見つかりませんでした");

  const resetButton = page.getByRole("button", {
    name: "検索と絞り込みを解除",
  });
  await expect(resetButton).toBeVisible();
  await resetButton.click();
  await expect(page.locator("main")).not.toContainText("写真が見つかりませんでした");
  await expect(page.locator(".pa-end-note")).toContainText("428");
  await expect(page).toHaveURL(/utm_source=synthetic/);
  const params = new URLSearchParams(new URL(page.url()).search);
  expect(params.get("q")).toBeNull();
  expect(params.get("medium")).toBeNull();

  await expectNoUnexpectedMutations(apiMocks);
});

test("公開PhotoApp — medium失敗はretry許可、再取得後にオーバーレイが更新され最終IDが一致", async ({
  page,
}) => {
  const failedPhoto = SYNTHETIC_PHOTOS[0];
  const delayedPhotos = new Map<number, number>([
    [SYNTHETIC_PHOTOS[2].id, 180],
    [SYNTHETIC_PHOTOS[3].id, 220],
    [SYNTHETIC_PHOTOS[4].id, 260],
  ]);
  const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS, {
    failMediumOnce: new Set([failedPhoto.id]),
    mediumDelayMs: delayedPhotos,
  });

  await page.goto("/gallery");
  await waitForPhotoGrid(page);

  await page
    .locator(`main.pa-scroll button[data-photo-tile="${failedPhoto.id}"]`)
    .click();
  const dialog = page.getByRole("dialog", { name: "写真ビューア" });
  await expect(dialog).toBeVisible();

  const thumb = dialog.locator(".pa-image-frame img").first();
  await expect(
    thumb.evaluate((image) =>
      image instanceof HTMLImageElement ? image.naturalWidth > 0 : false,
    ),
  ).resolves.toBe(true);

  const retryButton = page.getByRole("button", {
    name: "大きな写真を再読み込み",
  });
  await expect(retryButton).toBeVisible();
  await retryButton.click();
  await expect(retryButton).toBeHidden();
  await expect(dialog.locator("img.pa-full-image")).toBeVisible();

  const nextButton = dialog.getByRole("button", { name: "次の写真" });
  await nextButton.click();
  await nextButton.click();
  await dialog.getByRole("button", { name: "前の写真" }).click();

  const finalPhotoId = await extractPhotoIdFromPath(page);
  if (!finalPhotoId) {
    throw new Error("No final photo id");
  }

  await expect
    .poll(async () =>
      dialog
        .locator("img.pa-full-image")
        .getAttribute("src")
        .then((src) => src ?? ""),
    )
    .toContain(`${finalPhotoId}`);
  await expect(
    dialog.locator("img.pa-full-image"),
  ).toHaveAttribute("src", new RegExp(`/api/images/photos/medium/${finalPhotoId}\\.png`));

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expectNoUnexpectedMutations(apiMocks);
});

test("公開PhotoApp — reduced motion / high contrastでアニメは停止し glassは透過なし", async ({
  page,
}) => {
  await page.emulateMedia({
    contrast: "more",
    reducedMotion: "reduce",
  });
  const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS);
  await page.goto("/gallery");
  await waitForPhotoGrid(page);

  await expect(page.locator(".pa-public-nav")).toBeVisible();
  await expect(runningAnimations(page)).resolves.toBe(0);

  await page
    .locator("main.pa-scroll [data-photo-tile]")
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "写真ビューア" });
  await expect(dialog).toBeVisible();
  await expect(runningAnimations(page)).resolves.toBe(0);

  const toolbarColor = await page.locator(".pa-public-nav").evaluate(toolbar => getComputedStyle(toolbar).backgroundColor);
  const toolbarAlpha = extractBgAlpha(toolbarColor);
  expect(toolbarAlpha).toBe(1);

  const toolbarBackdrop = await page.locator(".pa-public-nav").evaluate((toolbar) => {
    const style = getComputedStyle(toolbar);
    return style.backdropFilter ?? "";
  });
  expect(toolbarBackdrop).toBe("none");

  await dialog
    .getByRole("button", { name: "次の写真" })
    .click();
  await expect(runningAnimations(page)).resolves.toBe(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(runningAnimations(page)).resolves.toBe(0);

  const glassAlpha = await page
    .locator(".pa-public-nav")
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(extractBgAlpha(glassAlpha)).toBe(1);

  await expectNoUnexpectedMutations(apiMocks);
});

test.describe("公開PhotoApp — 幅別レイアウト比較", () => {
  for (const viewport of [320, 1440] as const) {
    test(`viewport ${viewport}px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "desktopのみを実施");
      const apiMocks = await installPhotoAppApiMocks(page, SYNTHETIC_SETTINGS);
      await page.setViewportSize({ width: viewport, height: 900 });
      await page.goto("/gallery");
      await waitForPhotoGrid(page);

      const metrics = await page.evaluate(() => ({
        documentWidth: Math.ceil(document.documentElement.scrollWidth),
        viewportWidth: Math.ceil(window.innerWidth),
      }));
      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      await expect(page.locator(".pa-public-nav")).toBeVisible();
      await expect(page.locator(".pa-workspace")).toBeVisible();

      await expectNoUnexpectedMutations(apiMocks);
    });
  }
});
