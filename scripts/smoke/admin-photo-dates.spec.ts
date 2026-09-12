import { expect, test, type Page } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";
import { dateTiff } from "../../packages/web/src/test-fixtures/date-tiff";

async function fixture(page: Page) {
  const photos = [
    {
      id: 99101,
      filename: "missing.tif",
      shotAt: null,
      createdAt: "2026-09-13",
    },
    {
      id: 99102,
      filename: "old.tif",
      shotAt: "2024-03-01T12:00:00",
      createdAt: "2026-09-12",
    },
    {
      id: 99103,
      filename: "recent.tif",
      shotAt: "2024-03-02T12:00:00",
      createdAt: "2026-09-11",
    },
  ].map((p, i) => ({
    ...p,
    title: "",
    category: "",
    filmType: "フィルム",
    description: "",
    meta: "",
    sortOrder: i,
    width: 1200,
    height: 800,
    url: "/date-original.jpg",
    thumbUrl: "/date-thumb.svg",
    mediumUrl: "/date-medium.svg",
    isPublished: true,
  }));
  await page.route("**/api/photos?**", (route) =>
    route.fulfill({ json: { photos } }),
  );
  await page.route("**/date-*.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><path fill="#888" d="M0 0h1200v800H0z"/></svg>',
    }),
  );
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  await expect(page.locator("#admin-photo-99101")).toBeVisible();
  return photos;
}

test("撮影・スキャン順では日付なしが末尾、並び順は常時見える", async ({
  page,
}) => {
  await fixture(page);
  const sort = page.locator("[data-library-sort]");
  await expect(sort).toBeVisible();
  const ids = () =>
    page
      .locator("[data-library-photo-action]")
      .evaluateAll((elements) =>
        elements.map((e) => e.closest('[id^="admin-photo-"]')!.id),
      );
  await sort.selectOption("shotAt-desc");
  await expect
    .poll(ids)
    .toEqual(["admin-photo-99103", "admin-photo-99102", "admin-photo-99101"]);
  await sort.selectOption("shotAt-asc");
  await expect
    .poll(ids)
    .toEqual(["admin-photo-99102", "admin-photo-99103", "admin-photo-99101"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test("TIF取り込み前にスキャン日時を確認し、明示した後だけ登録する", async ({
  page,
}) => {
  const photos = await fixture(page);
  const uploads: string[] = [];
  const registrations: Record<string, unknown>[] = [];
  await page.route("**/api/admin/upload", (route) => {
    uploads.push("upload");
    return route.fulfill({
      status: 201,
      json: {
        url: "/date-original.jpg",
        width: 1,
        height: 1,
        shotAt: "2024-03-02T12:34:56",
        exifDateDigitized: "2025-05-01T01:02:03",
        sourceFormat: "tiff",
      },
    });
  });
  await page.route("**/api/admin/photos", (route) => {
    const data = route.request().postDataJSON();
    registrations.push(data);
    const photo = { ...photos[0], ...data, id: 99104, sortOrder: 3 };
    photos.push(photo);
    return route.fulfill({ status: 201, json: { photo } });
  });
  await page
    .getByLabel(/画像ファイルを選択|Choose image files/)
    .setInputFiles({
      name: "camera-scan.tif",
      mimeType: "image/tiff",
      buffer: dateTiff("2024:03:02 12:34:56", "2025:05:01 01:02:03"),
    });
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "フィルムのスキャン" }).check();
  await expect(dialog).toContainText("2024-03-02 12:34:56");
  expect(uploads).toEqual([]);
  expect(registrations).toEqual([]);
  await dialog
    .getByRole("button", { name: "1枚を取り込む", exact: true })
    .click();
  await expect.poll(() => registrations.length).toBe(1);
  expect(registrations[0]).toMatchObject({
    filmType: "フィルム",
    shotAt: "2024-03-02T12:34:56",
    shotAtSource: "exif_original",
    shotAtDigitized: "2024-03-02T12:34:56",
  });
});

test("既存写真の日付だけを元TIFから復元し、画像を再送しない", async ({
  page,
}) => {
  const photos = await fixture(page);
  const patches: Record<string, unknown>[] = [];
  await page.route("**/api/admin/photos/99101", (route) => {
    const patch = route.request().postDataJSON();
    patches.push(patch);
    Object.assign(photos[0], patch);
    return route.fulfill({ json: { ok: true } });
  });
  await page.locator("#admin-photo-99101 [data-library-photo-action]").click();
  await page.getByRole("button", { name: /日時なし · 日付を確認/ }).click();
  await page
    .getByRole("button", { name: "元ファイルから日時を読み直す", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("日付を読み直す元ファイル")
    .setInputFiles({
      name: "missing.tif",
      mimeType: "image/tiff",
      buffer: dateTiff("2024:03:02 12:34:56"),
    });
  await expect(dialog).toContainText("2024-03-02 12:34:56");
  expect(patches).toEqual([]);
  await dialog
    .getByRole("button", { name: "1枚の日付を更新", exact: true })
    .click();
  await expect(dialog).toContainText("保存済み");
  expect(patches).toEqual([
    { shotAt: "2024-03-02T12:34:56", shotAtSource: "exif_original" },
  ]);
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.locator(".admin-photo-date-source")).toContainText(
    "2024-03-02 12:34:56",
  );
});

test("日付のないTIFは空欄が既定で、狭い確認画面にも収まる", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByLabel(/画像ファイルを選択|Choose image files/)
    .setInputFiles({
      name: "no-date.tif",
      mimeType: "image/tiff",
      buffer: dateTiff(),
    });
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "1枚を取り込む", exact: true }),
  ).toBeEnabled();
  await expect(dialog.getByRole("combobox")).toHaveValue("exif");
  await expect(dialog).toContainText("日時なし");
  expect(
    await dialog.evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator(".admin-palette")).toHaveCount(0);
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  if (page.viewportSize()!.width >= 1200) {
    await page.getByRole("button", { name: /クイック移動/ }).click();
    await expect(page.locator(".admin-palette")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".admin-palette")).toHaveCount(0);
  }
});

test("日付順で末尾に追加した写真にも着地できる", async ({ page }) => {
  const photos = await fixture(page);
  for (let i = 0; i < 100; i++)
    photos.push({
      ...photos[1],
      id: 99200 + i,
      filename: `existing-${i}.tif`,
      sortOrder: 3 + i,
    });
  await page.reload();
  await page.locator("[data-library-sort]").selectOption("shotAt-desc");
  await page.route("**/api/admin/upload", (route) =>
    route.fulfill({
      status: 201,
      json: {
        url: "/date-original.jpg",
        shotAt: null,
        exifDateDigitized: null,
      },
    }),
  );
  await page.route("**/api/admin/photos", (route) => {
    const body = route.request().postDataJSON();
    expect(body.shotAt).toBe("");
    expect(body.shotAtSource).toBe("none");
    const photo = { ...photos[0], ...body, id: 99301, sortOrder: 103 };
    photos.push(photo);
    return route.fulfill({ status: 201, json: { photo } });
  });
  await page
    .getByLabel(/画像ファイルを選択|Choose image files/)
    .setInputFiles({
      name: "undated-new.tif",
      mimeType: "image/tiff",
      buffer: dateTiff(),
    });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "1枚を取り込む", exact: true })
    .click();
  await expect(page.locator("#admin-photo-99301")).toBeInViewport();
  await expect(page.locator("[data-library-sort]")).toHaveValue("shotAt-desc");
  await expect(
    page.locator("[data-library-recently-added-section]"),
  ).toHaveCount(0);
});

test("拡大・編集は生成済み画像を共通で使う", async ({ page }) => {
  await fixture(page);
  await page.locator("#admin-photo-99101 [data-library-photo-action]").click();
  const preview = page.locator(".admin-inspector-preview img");
  await expect(preview).toHaveAttribute("src", "/date-medium.svg");
  await page
    .getByRole("button", { name: "写真を大きく見る", exact: true })
    .click();
  await expect(
    page.locator(".admin-library-photo-preview img"),
  ).toHaveAttribute("src", "/date-medium.svg");
});
