import { expect, test, type Page, type Route } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

type MockPhoto = {
  id: number;
  filename: string;
  url: string;
  title: string;
  meta: string;
  description: string;
  category: string;
  camera: null;
  lens: null;
  filmType: string;
  width: number;
  height: number;
  sortOrder: number;
  displaySize: "M";
  seriesId: null;
  isPublished: boolean;
  rotationDeg: number;
  focalX: number;
  focalY: number;
  createdAt: string;
  shotAt: string | null;
  thumbUrl: null;
  mediumUrl: null;
};

type ImportHarness = {
  photos: MockPhoto[];
  reorderRequests: number[][];
};

function mockPhoto(
  id: number,
  filename: string,
  overrides: Partial<MockPhoto> = {},
): MockPhoto {
  return {
    id,
    filename,
    url: "/og-image.jpg",
    title: filename,
    meta: "",
    description: "",
    category: "",
    camera: null,
    lens: null,
    filmType: "デジタル",
    width: 1200,
    height: 800,
    sortOrder: id,
    displaySize: "M",
    seriesId: null,
    isPublished: true,
    rotationDeg: 0,
    focalX: 50,
    focalY: 50,
    createdAt: `2026-07-${String((id % 20) + 1).padStart(2, "0")}T00:00:00.000Z`,
    shotAt: null,
    thumbUrl: null,
    mediumUrl: null,
    ...overrides,
  };
}

async function uploadedFilename(
  route: Route,
  knownFilenames: Iterable<string>,
) {
  const body = route.request().postDataBuffer()?.toString("utf8") ?? "";
  const filename = Array.from(knownFilenames).find((name) =>
    body.includes(`filename="${name}"`),
  );
  if (!filename) throw new Error("mock upload filename was not found");
  return filename;
}

async function installImportHarness(
  page: Page,
  initialPhotos: MockPhoto[],
  addedIdsByFilename: ReadonlyMap<string, number>,
): Promise<ImportHarness> {
  const harness: ImportHarness = {
    photos: [...initialPhotos],
    reorderRequests: [],
  };

  await page.route("**/api/photos?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ photos: harness.photos }),
    });
  });
  await page.route("**/api/admin/upload", async (route) => {
    const filename = await uploadedFilename(route, addedIdsByFilename.keys());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        url: `/mock/${filename}`,
        width: 1200,
        height: 800,
        fileHash: `hash-${filename}`,
        thumbKey: null,
        mediumKey: null,
        shotAt: null,
        exifDateDigitized: null,
        exifCamera: null,
        exifLens: null,
        exifFocalLength: null,
        exifFNumber: null,
        exifExposureTime: null,
        exifIso: null,
      }),
    });
  });
  await page.route("**/api/admin/photos", async (route) => {
    expect(route.request().method()).toBe("POST");
    const body = route.request().postDataJSON() as { filename: string };
    const id = addedIdsByFilename.get(body.filename);
    if (!id) throw new Error(`unexpected photo registration: ${body.filename}`);
    const photo = mockPhoto(id, body.filename);
    harness.photos = [...harness.photos, photo];
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ photo }),
    });
  });
  await page.route("**/api/admin/photos/reorder", async (route) => {
    const body = route.request().postDataJSON() as { ids: number[] };
    harness.reorderRequests.push([...body.ids]);
    const photosById = new Map(
      harness.photos.map((photo) => [photo.id, photo]),
    );
    harness.photos = body.ids
      .map((id) => photosById.get(id))
      .filter((photo): photo is MockPhoto => Boolean(photo));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  return harness;
}

async function importMockFiles(page: Page, filenames: string[]) {
  await page
    .getByLabel(/画像ファイルを選択|Choose image files/)
    .setInputFiles(
      filenames.map((name) => ({
        name,
        mimeType: "image/jpeg",
        buffer: Buffer.from(name),
      })),
    );
}

const photoTile = (page: Page, id: number) =>
  page.locator(`#admin-photo-${id}`);

async function tileIds(locator: ReturnType<Page["locator"]>) {
  return locator.evaluateAll((elements) =>
    elements.map((element) =>
      Number(element.id.replace("admin-photo-", "")),
    ),
  );
}

async function trackScrollTo(locator: ReturnType<Page["locator"]>) {
  await locator.evaluate((element) => {
    const scrollElement = element as HTMLElement;
    scrollElement.dataset.programmaticScrollCount = "0";
    const originalScrollTo = scrollElement.scrollTo.bind(scrollElement);
    scrollElement.scrollTo = ((options: ScrollToOptions) => {
      scrollElement.dataset.programmaticScrollCount = String(
        Number(scrollElement.dataset.programmaticScrollCount ?? "0") + 1,
      );
      originalScrollTo(options);
    }) as typeof scrollElement.scrollTo;
  });
}

test.describe("admin — 「今回追加」を一覧先頭へ一時表示", () => {
  test("全体添字・並べ替え・Table・置き換え・解除を一続きで保つ", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "複合操作はAPI差し替え済みdesktopで1回確認",
    );

    const addedIds = new Map([
      ["z-added-a.jpg", 101],
      ["z-added-b.jpg", 102],
      ["y-added-next.jpg", 103],
    ]);
    const harness = await installImportHarness(
      page,
      [
        mockPhoto(1, "alpha.jpg"),
        mockPhoto(2, "bravo.jpg"),
        mockPhoto(3, "charlie.jpg"),
      ],
      addedIds,
    );

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    const libraryScroll = page.locator("[data-library-scroll]");
    await trackScrollTo(libraryScroll);

    await importMockFiles(page, ["z-added-a.jpg", "z-added-b.jpg"]);

    const section = page.locator("[data-library-recently-added-section]");
    await expect(section).toHaveAttribute(
      "aria-labelledby",
      "library-recently-added-heading",
    );
    await expect(
      section.locator("[data-library-recently-added-heading]"),
    ).toHaveText(/今回追加 2枚|Added in this import: 2/);
    await expect(
      section.locator("[data-library-recently-added-filter-note]"),
    ).toHaveCount(0);
    await expect(page.locator("[data-library-mode]")).toHaveAttribute(
      "data-library-mode",
      "select",
    );
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).toHaveAttribute("data-library-selected-count", "2");
    await expect
      .poll(async () =>
        Number(
          (await libraryScroll.getAttribute(
            "data-programmatic-scroll-count",
          )) ?? "0",
        ),
      )
      .toBeGreaterThan(0);
    expect(
      await tileIds(section.locator(".admin-photo-tile")),
    ).toEqual([101, 102]);
    expect(
      await tileIds(
        page.locator("[data-library-grid-mode] .admin-photo-tile"),
      ),
    ).toEqual([1, 2, 3]);
    for (const id of [1, 2, 3, 101, 102]) {
      await expect(photoTile(page, id)).toHaveCount(1);
    }
    await expect(
      section
        .locator("[data-library-photo-action]")
        .first(),
    ).not.toHaveAttribute(
      "aria-label",
      /今回追加|Added in this import/i,
    );
    await expect
      .poll(async () =>
        Number(
          (await page
            .locator("[data-library-grid-mode]")
            .getAttribute("data-library-grid-offset-top")) ?? "0",
        ),
      )
      .toBeGreaterThan(0);

    // 全体添字は pinned → regular。境界を左右キーで往復する。
    await page.locator('[data-library-mode-action="end-select"]').click();
    await page.locator('[data-library-mode-action="select"]').click();
    await photoTile(page, 102)
      .locator("[data-library-photo-action]")
      .click();
    await page.keyboard.press("ArrowRight");
    await expect(
      photoTile(page, 1).locator(".admin-select-mark"),
    ).not.toHaveAttribute("data-state", "hidden");
    await page.keyboard.press("ArrowLeft");
    await expect(
      photoTile(page, 102).locator(".admin-select-mark"),
    ).not.toHaveAttribute("data-state", "hidden");

    // Shift範囲選択も pinned 2枚と regular 先頭を1本の配列として扱う。
    await photoTile(page, 101)
      .locator("[data-library-photo-action]")
      .click();
    await photoTile(page, 1)
      .locator("[data-library-photo-action]")
      .click({ modifiers: ["Shift"] });
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).toHaveAttribute("data-library-selected-count", "3");
    await page.locator('[data-library-mode-action="end-select"]').click();

    // 表示用ソートを変えても区画は先頭に残る。
    await page.locator("[data-library-sort]").selectOption("title");
    await expect(section).toBeVisible();
    expect(
      await tileIds(section.locator(".admin-photo-tile")),
    ).toEqual([101, 102]);
    await page.locator("[data-library-sort]").selectOption("manual");

    // 並べ替え中は区画だけを隠し、保存される順は従来の通常一覧そのもの。
    await page.locator('[data-library-mode-action="arrange"]').click();
    await expect(section).toHaveCount(0);
    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(2);
    // ドラッグ元は写真全体ではなく取っ手。ID 1 を ID 3 に落とすと、
    // 1 を一度抜いた [2, 3, 101, 102] の ID 3 の直前へ入るため、保存列は
    // [2, 1, 3, 101, 102] になる。下方向でも「対象の直前」という新規則の確認。
    await photoTile(page, 1)
      .getByRole("button", { name: /ドラッグして並べ替え|Drag to reorder/ })
      .dragTo(photoTile(page, 3));
    await expect.poll(() => harness.reorderRequests.length).toBe(1);
    expect(harness.reorderRequests[0]).toEqual([2, 1, 3, 101, 102]);
    await page
      .locator('[data-library-mode-action="finish-arrange"]:visible')
      .click();
    await expect(section).toBeVisible();

    // Tableは表示モードを保ち、8列をまたぐ見出しと先頭行を出す。
    const tableButton = page.getByRole("button", { name: "Table" });
    await tableButton.click();
    await expect(tableButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator("[data-library-recently-added-table-heading]"),
    ).toContainText(/今回追加 2枚|Added in this import: 2/);
    const tableRows = page.locator("[data-bulk-edit-photo-id]");
    await expect(tableRows.nth(0)).toHaveAttribute(
      "data-bulk-edit-photo-id",
      "101",
    );
    await expect(tableRows.nth(1)).toHaveAttribute(
      "data-bulk-edit-photo-id",
      "102",
    );

    const tableScroll = page.locator("[data-bulk-edit-table-scroll]");
    await trackScrollTo(tableScroll);
    await importMockFiles(page, ["y-added-next.jpg"]);
    await expect(page.locator("[data-library-mode]")).toHaveAttribute(
      "data-library-mode",
      "select",
    );
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).toHaveAttribute("data-library-selected-count", "1");
    await expect(
      page.locator("[data-library-recently-added-table-heading]"),
    ).toContainText(/今回追加 1枚|Added in this import: 1/);
    await expect(tableRows.nth(0)).toHaveAttribute(
      "data-bulk-edit-photo-id",
      "103",
    );
    await expect
      .poll(async () =>
        Number(
          (await tableScroll.getAttribute(
            "data-programmatic-scroll-count",
          )) ?? "0",
        ),
      )
      .toBeGreaterThan(0);

    await page.locator('[data-library-mode-action="end-select"]').click();
    await expect(tableButton).toHaveAttribute("aria-pressed", "true");
    await tableButton.click();
    await expect(section).toHaveAttribute(
      "data-library-recently-added-count",
      "1",
    );
    expect(
      await tileIds(section.locator(".admin-photo-tile")),
    ).toEqual([103]);
    await expect(
      page.locator("[data-library-grid-mode] #admin-photo-101"),
    ).toHaveCount(1);
    await expect(
      page.locator("[data-library-grid-mode] #admin-photo-102"),
    ).toHaveCount(1);

    // 明示解除で全写真が本来の通常一覧へ戻り、補正値も0へ戻る。
    await page.locator("[data-library-recently-added-dismiss]").click();
    await expect(section).toHaveCount(0);
    await expect(
      page.locator("[data-library-grid-mode] #admin-photo-103"),
    ).toHaveCount(1);
    await expect
      .poll(async () =>
        Number(
          (await page
            .locator("[data-library-grid-mode]")
            .getAttribute("data-library-grid-offset-top")) ?? "-1",
        ),
      )
      .toBe(0);

    await page.reload();
    await gotoAdminTab(page, "gallery");
    await expect(section).toHaveCount(0);
  });

  test("絞り込み外の追加写真だけを一時表示し、解除後は見えなくする", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "絞り込み外の固定応答はdesktopで1回確認",
    );

    await installImportHarness(
      page,
      [mockPhoto(1, "alpha.jpg")],
      new Map([["outside-filter.jpg", 101]]),
    );
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await page.locator("[data-library-filters-toggle]").click();
    await page
      .locator("[data-library-search-input]")
      .fill("__no_photo_matches__");
    await expect(page.locator('[data-library-empty="search"]')).toBeVisible();

    await importMockFiles(page, ["outside-filter.jpg"]);

    const section = page.locator("[data-library-recently-added-section]");
    await expect(section).toBeVisible();
    await expect(
      section.locator("[data-library-recently-added-filter-note]"),
    ).toHaveText(
      /現在の絞り込みに関係なく表示しています|Shown regardless of the current filters/,
    );
    await expect(photoTile(page, 101)).toBeVisible();
    await expect(
      page.locator("[data-library-grid-mode] .admin-photo-tile"),
    ).toHaveCount(0);

    await page.locator("[data-library-recently-added-dismiss]").click();
    await expect(section).toHaveCount(0);
    await expect(photoTile(page, 101)).toHaveCount(0);
    await expect(page.locator('[data-library-empty="search"]')).toBeVisible();
  });

  test("390px幅で一時区画が横にはみ出さない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "390px幅だけを確認");
    await page.setViewportSize({ width: 390, height: 844 });
    await installImportHarness(
      page,
      [mockPhoto(1, "alpha.jpg"), mockPhoto(2, "bravo.jpg")],
      new Map([
        ["mobile-added-a.jpg", 101],
        ["mobile-added-b.jpg", 102],
      ]),
    );
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await importMockFiles(page, [
      "mobile-added-a.jpg",
      "mobile-added-b.jpg",
    ]);

    const section = page.locator("[data-library-recently-added-section]");
    await expect(section).toBeVisible();
    expect(
      await section.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.locator("[data-library-scroll]").evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  });

  test("497枚＋今回追加50枚でも通常一覧だけを仮想化する", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "大件数の描画枚数はdesktopで1回実測",
    );
    test.setTimeout(90_000);

    const initialPhotos = Array.from({ length: 497 }, (_, index) =>
      mockPhoto(index + 1, `base-${String(index + 1).padStart(3, "0")}.jpg`),
    );
    const addedEntries = Array.from({ length: 50 }, (_, index) => [
      `pinned-${String(index + 1).padStart(2, "0")}.jpg`,
      1001 + index,
    ] as const);
    await installImportHarness(
      page,
      initialPhotos,
      new Map(addedEntries),
    );
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    const grid = page.locator("[data-library-grid-mode]");
    await expect(grid).toHaveAttribute("data-virtualized", "true");
    const beforeCount = Number(
      (await grid.getAttribute("data-rendered-count")) ?? "0",
    );
    expect(beforeCount).toBeGreaterThan(0);
    expect(await page.locator(".admin-photo-tile").count()).toBe(beforeCount);

    await importMockFiles(
      page,
      addedEntries.map(([filename]) => filename),
    );
    await expect(
      page.locator("[data-library-recently-added-section]"),
    ).toHaveAttribute("data-library-recently-added-count", "50");
    await expect(grid).toHaveAttribute("data-virtualized", "true");
    const renderedCount = Number(
      (await grid.getAttribute("data-rendered-count")) ?? "0",
    );
    console.log(
      `[recently-added-performance] data-rendered-count=${renderedCount}`,
    );
    expect(renderedCount).toBeGreaterThan(50);
    expect(renderedCount).toBeLessThanOrEqual(180);
    expect(await page.locator(".admin-photo-tile").count()).toBe(
      renderedCount,
    );

    await page.locator("[data-library-scroll]").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(photoTile(page, 497)).toBeVisible();
    await expect(grid).toHaveAttribute("data-virtualized", "true");
  });
});
