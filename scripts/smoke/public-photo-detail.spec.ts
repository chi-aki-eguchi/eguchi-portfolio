import { test, expect } from "@playwright/test";

test("a directly opened photo becomes visible after its data arrives", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/images/")) {
      await route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#9a8171"/></svg>',
      });
      return;
    }
    if (path === "/api/photos/42") {
      // The first render has a loading state, so there is no figure to observe.
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ json: {
        photo: { id: 42, url: "/api/images/detail.webp", thumbUrl: "/api/images/detail.webp", title: "A quiet room", description: "", width: 600, height: 400, rotationDeg: 0, seriesId: null },
        series: null, prev: null, next: null,
      }});
      return;
    }
    const payload = path === "/api/settings"
      ? { siteName: "Photographer", siteUrl: "https://portfolio.example", servicePageMode: "off" }
      : path === "/api/series" ? { series: [] }
      : path === "/api/categories" ? { categories: [] }
      : { photos: [] };
    await route.fulfill({ json: payload });
  });
  await page.goto("/photo/42", { waitUntil: "domcontentloaded" });
  const figure = page.locator("main figure");
  await expect(figure.locator("h1")).toContainText("A quiet room");
  await expect.poll(() => figure.evaluate((element) => {
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  })).toBeGreaterThan(0.95);
  await expect.poll(() => figure.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('main a[href="/gallery"]')).toBeVisible();
});
