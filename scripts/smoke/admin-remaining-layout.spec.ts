import { expect, test, type Page, type Route } from "@playwright/test";

const PHOTOS = Array.from({ length: 5 }, (_, index) => ({
  id: 8_200_000 + index,
  filename: `hero-${index}.jpg`,
  url: `/api/images/hero/${index}.jpg`,
  thumbUrl: `/api/images/hero/thumb-${index}.jpg`,
  mediumUrl: `/api/images/hero/medium-${index}.jpg`,
  title: `Hero写真 ${index + 1}`,
  description: "",
  category: "work",
  camera: null,
  lens: null,
  focalLength: null,
  fNumber: null,
  exposureTime: null,
  iso: null,
  filmType: "digital",
  shotAt: null,
  displaySize: "M",
  width: 1200,
  height: 800,
  rotationDeg: 0,
  focalX: 50,
  focalY: 50,
  sortOrder: index,
  seriesId: 91,
  isPublished: true,
  fileHash: null,
  deletedAt: null,
  createdAt: new Date(Date.UTC(2026, 6, index + 1)).toISOString(),
}));

async function installMocks(page: Page) {
  const state = {
    heroIds: PHOTOS.map((photo) => photo.id),
    reorderWrites: [] as number[][],
    unknownWrites: [] as string[],
  };
  const json = (value: unknown) => (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

  await page.route("**/api/**", async (route) => {
    if (!["GET", "HEAD"].includes(route.request().method())) {
      state.unknownWrites.push(
        `${route.request().method()} ${route.request().url()}`,
      );
      await route.fulfill({ status: 500, body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.route("**/api/images/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: Buffer.from([]),
    }),
  );
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route(
    "**/api/settings**",
    json({
      setupCompleted: "true",
      siteName: "残画面fixture",
      gallerySortOrder: "manual",
      servicePageMode: "off",
    }),
  );
  await page.route("**/api/photos**", json({ photos: PHOTOS }));
  const categoriesResponse = {
    categories: [
      { id: 81, slug: "work", label: "Work", sortOrder: 0 },
      { id: 82, slug: "life", label: "Life", sortOrder: 1 },
    ],
  };
  await page.route("**/api/categories**", json(categoriesResponse));
  await page.route("**/api/admin/categories**", json(categoriesResponse));
  const seriesResponse = {
    series: [
      {
        id: 91,
        slug: "quiet",
        title: "Quiet",
        subtitle: "2026",
        statement: "長い説明を持つシリーズ",
        coverPhotoId: PHOTOS[0].id,
        sortOrder: 0,
        isPublished: true,
        themeConfig: "",
      },
    ],
  };
  await page.route("**/api/series**", json(seriesResponse));
  await page.route("**/api/admin/series**", json(seriesResponse));
  const handleHeroPhotos = async (route: Route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { photoIds: number[] };
      state.heroIds = [...body.photoIds];
      state.reorderWrites.push([...body.photoIds]);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        heroPhotos: state.heroIds.map((photoId, index) => ({
          id: 9_000 + index,
          photoId,
          sortOrder: index,
        })),
      }),
    });
  };
  await page.route("**/api/hero-photos**", handleHeroPhotos);
  await page.route("**/api/admin/hero-photos**", handleHeroPhotos);
  await page.route("**/api/pricing**", json({ plans: [] }));
  await page.route("**/api/admin/pricing**", json({ plans: [] }));
  return state;
}

async function openTab(page: Page, tab: string) {
  await page.addInitScript((nextTab) => {
    localStorage.setItem("admin:tab", JSON.stringify(nextTab));
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

test.describe("admin — 残画面のWorkspace / Form振り分け", () => {
  test("Heroは対象1枚と下部帯を使い、保存連打・番号移動・Undoを安全に扱う", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PCの下部帯で検証");
    const state = await installMocks(page);
    await openTab(page, "hero");

    const workspace = page.locator('[data-admin-workspace="hero"]');
    await expect(workspace).toBeVisible();
    await expect(workspace.locator("[data-admin-page-shell]")).toHaveCount(0);
    const slides = workspace.locator("[data-hero-slide]");
    await expect(slides).toHaveCount(5);
    await expect(slides.first().locator("button")).toHaveCount(1);

    await slides.nth(2).locator("button").click();
    const bar = page.locator('[data-admin-reorder-scope="hero"]');
    await expect(bar).toBeVisible();
    await expect(slides.nth(2)).toHaveAttribute(
      "data-hero-reorder-target",
      "true",
    );

    await bar.getByRole("button", { name: "先頭へ移動" }).click();
    await expect.poll(() => state.reorderWrites.length).toBe(1);
    await expect(bar).toHaveAttribute(
      "data-library-reorder-target",
      String(PHOTOS[2].id),
    );

    const position = bar.locator("[data-library-position-input]");
    await position.fill("5");
    await bar.getByRole("button", { name: "移動する" }).click();
    await expect.poll(() => state.reorderWrites.length).toBe(2);
    expect(state.heroIds.at(-1)).toBe(PHOTOS[2].id);

    await bar
      .getByRole("button", { name: "直前の並べ替えを元に戻す" })
      .click();
    await expect.poll(() => state.reorderWrites.length).toBe(3);
    expect(state.heroIds[0]).toBe(PHOTOS[2].id);

    await slides
      .nth(0)
      .locator("button")
      .dragTo(slides.nth(2).locator("button"));
    await expect.poll(() => state.reorderWrites.length).toBe(4);
    expect(state.heroIds[2]).toBe(PHOTOS[2].id);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".admin-bottom-nav")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.body.scrollWidth - document.body.clientWidth,
      ),
    ).toBe(0);
    await bar.getByRole("button", { name: "選び直す" }).click();
    await expect(bar).toHaveCount(0);
    await expect(page.locator(".admin-bottom-nav")).toBeVisible();
    expect(state.unknownWrites).toEqual([]);
  });

  test("Seriesは一覧Workspace＋720px編集Form、Categoriesは短いFormを使う", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "3幅をdesktopで連続検証");
    const state = await installMocks(page);

    await openTab(page, "categories");
    await expect(page.locator('[data-admin-page-shell="form"]')).toBeVisible();
    await expect(page.locator('[data-admin-workspace="categories"]')).toHaveCount(
      0,
    );

    await openTab(page, "series");
    const workspace = page.locator('[data-admin-workspace="series"]');
    await expect(workspace).toBeVisible();
    await page.getByRole("button", { name: "編集" }).click();
    const editor = page.locator('[data-admin-mixed-form="series-edit"]');
    await expect(editor).toBeVisible();

    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await editor.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        overflow: document.body.scrollWidth - document.body.clientWidth,
      }));
      expect(geometry.width).toBeLessThanOrEqual(722);
      expect(geometry.overflow).toBe(0);
    }
    expect(state.unknownWrites).toEqual([]);
  });
});
