import { test, expect } from "./fixtures.ts";
for (const design of ["book", "classic"]) {
  test(`Gallery waits for its actual ${design} layout before showing headings and filters`, async ({ page, api }) => {
    const base = await (await api.get("/api/settings")).json();
    const categories = await (await api.get("/api/categories")).json();
    const photos = await (await api.get("/api/photos")).json();
    let releaseSettings!: () => void;
    let releaseCategories!: () => void;
    let releasePhotos!: () => void;
    const settingsReady = new Promise<void>(resolve => { releaseSettings = resolve; });
    const categoriesReady = new Promise<void>(resolve => { releaseCategories = resolve; });
    const photosReady = new Promise<void>(resolve => { releasePhotos = resolve; });
    await page.route("**/api/settings", async route => {
      await settingsReady;
      await route.fulfill({ json: { ...base, siteDesign: design, pageTitleStyle: "display", galleryLabel: "Selected photographs", navLabelGallery: "Selected photographs" } });
    });
    await page.route("**/api/categories", async route => {
      await categoriesReady;
      await route.fulfill({ json: categories });
    });
    await page.route("**/api/photos", async route => {
      await photosReady;
      await route.fulfill({ json: photos });
    });
    try {
      await page.goto("/gallery", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main").getByText("読み込み中…", { exact: true })).toBeVisible();
      await expect(page.locator("main h1")).toHaveCount(0);
      releaseSettings();
      await expect(page.locator("main").getByText("読み込み中…", { exact: true })).toBeVisible();
      releaseCategories();
      await expect(page.locator("main").getByText("読み込み中…", { exact: true })).toBeVisible();
      releasePhotos();
      const title = page.locator("main h1");
      await expect(title).toHaveText("Selected photographs");
      await expect(title).toBeVisible();
      await expect(title).toHaveClass(design === "book" ? /ps-page-head__title/ : /font-bold/);
      await expect(page.locator("main img").first()).toBeVisible();
      await expect(page.locator("main").getByText("読み込み中…", { exact: true })).toHaveCount(0);
    } finally {
      releaseSettings();
      releaseCategories();
      releasePhotos();
    }
  });
}
