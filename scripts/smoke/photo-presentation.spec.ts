import { test, expect } from "./fixtures.ts";
import { loginAsAdmin, chooseSettingsSection } from "./helpers";

test("Photo presentation previews before save and persists through reload", async ({ page, api }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const settings = { ...await (await api.get("/api/settings")).json(), siteDesign: "classic", photoCrop: "fill", viewerMat: "full" };
  const writes: Record<string, string>[] = [];
  await page.route("**/api/settings**", r => r.fulfill({ json: settings }));
  await page.route("**/api/admin/settings**", async r => {
    const payload = r.request().postDataJSON();
    writes.push(payload);
    Object.assign(settings, payload);
    await r.fulfill({ json: { ok: true, ignoredKeys: [] } });
  });
  await loginAsAdmin(page);
  await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
  // 切り抜き（いつもの構成の札・帯・表紙）と額装（写真を開いたとき）は別の節。
  // 節をまたいでも下書きは1つで、1回の保存でまとめて送る。
  await chooseSettingsSection(page, "series-cards");
  await page.getByRole("button", { name: "切り抜かず全体を見せる", exact: true }).click();
  await chooseSettingsSection(page, "viewer");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.getByRole("button", { name: "額装", exact: true }).click();
  const frame = page.locator('iframe[title="Site Preview"]');
  await expect.poll(() => frame.evaluate((el: HTMLIFrameElement) => el.contentDocument?.body.dataset.photoCrop)).toBe("whole");
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ photoCrop: "whole", viewerMat: "framed" });
  await page.reload({ waitUntil: "networkidle" });
  await expect.poll(() => frame.evaluate((el: HTMLIFrameElement) => el.contentDocument?.body.dataset.photoCrop)).toBe("whole");
  expect(settings.viewerMat).toBe("framed");
});

test("Uncropped hero and series cover remain inside the page", async ({ page, api }) => {
  const settings = await (await api.get("/api/settings")).json();
  await page.route("**/api/settings**", r => r.fulfill({ json: { ...settings, siteDesign: "classic", photoCrop: "whole", heroMode: "single" } }));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toHaveAttribute("data-photo-crop", "whole");
  const hero = page.locator(".hero-single-img");
  await expect(hero).toBeVisible();
  expect(await hero.evaluate(el => getComputedStyle(el).objectFit)).toBe("contain");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const result = await (await api.get("/api/series")).json();
  const series = result.series.find((s: { coverUrl?: string }) => s.coverUrl);
  expect(series).toBeTruthy();
  expect(series.coverWidth).toBeGreaterThan(0);
  expect(series.coverHeight).toBeGreaterThan(0);
  await page.goto(`/series/${series.slug}`, { waitUntil: "networkidle" });
  const cover = page.locator(".series-cover__img");
  await expect(cover).toBeVisible();
  expect(await cover.evaluate(el => getComputedStyle(el).objectFit)).toBe("contain");
  const boxes = await page.evaluate(() => {
    const photo = document.querySelector(".series-cover__img")!.getBoundingClientRect();
    const caption = document.querySelector(".series-cover__caption")!.getBoundingClientRect();
    return { photoBottom: photo.bottom, captionTop: caption.top, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(boxes.captionTop).toBeGreaterThanOrEqual(boxes.photoBottom - 1);
  expect(boxes.overflow).toBeLessThanOrEqual(1);
});

test("Uncropped carousel uses the site background around photographs", async ({ page, api }) => {
  const settings = await (await api.get("/api/settings")).json();
  await page.route("**/api/settings**", r => r.fulfill({ json: { ...settings, siteDesign: "classic", photoCrop: "whole", heroMode: "carousel" } }));
  await page.goto("/", { waitUntil: "networkidle" });
  const stage = page.locator(".hero-carousel-contain");
  await expect(stage).toBeVisible();
  const colors = await stage.evaluate(el => ({ stage: getComputedStyle(el).backgroundColor, page: getComputedStyle(document.body).backgroundColor }));
  expect(colors.stage).toBe(colors.page);
});

test("Fullscreen uncropped carousel keeps its title within portrait and panorama photos", async ({ page, api }) => {
  const settings = await (await api.get("/api/settings")).json();
  const heroData = await (await api.get("/api/hero-photos")).json();
  let width = 600;
  let height = 900;
  await page.route("**/api/settings**", r => r.fulfill({ json: { ...settings, siteDesign: "classic", photoCrop: "whole", heroMode: "carousel", heroDisplayMode: "fullscreen", heroTitlePosition: "bottom-left" } }));
  await page.route("**/api/hero-photos**", r => r.fulfill({ json: { heroPhotos: [{ ...heroData.heroPhotos[0], width, height, rotationDeg: 0 }] } }));
  for (const size of [[600, 900], [1500, 500]]) {
    [width, height] = size;
    await page.goto("/", { waitUntil: "networkidle" });
    const title = page.locator(".hero-carousel-caption");
    await expect(title).toBeVisible();
    const measure = await title.evaluate((el, ratio) => {
      const stage = document.querySelector(".hero-carousel-contain")!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const w = Math.min(stage.width, stage.height * ratio);
      const h = Math.min(stage.height, stage.width / ratio);
      return { left: r.left, right: r.right, bottom: r.bottom, photoLeft: stage.left + (stage.width - w) / 2, photoRight: stage.right - (stage.width - w) / 2, photoBottom: stage.bottom - (stage.height - h) / 2 };
    }, width / height);
    expect(measure.left).toBeGreaterThanOrEqual(measure.photoLeft - 2);
    expect(measure.right).toBeLessThanOrEqual(measure.photoRight + 2);
    expect(measure.bottom).toBeLessThanOrEqual(measure.photoBottom + 2);
  }
});

test("Mobile column limit and contact sheet keep photos usable", async ({ page, api }) => {
  const settings = await (await api.get("/api/settings")).json();
  let mode = "grid";
  await page.route("**/api/settings**", r => r.fulfill({ json: { ...settings, siteDesign: "classic", galleryLayout: mode, galleryColumns: "12", galleryColumnsMobile: "2", gallerySizeScale: "0.5", galleryEmptyRate: "0" } }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/gallery", { waitUntil: "networkidle" });
  const tiles = page.locator("[data-photo-tile]");
  await expect(tiles.first()).toBeVisible();
  const columns = await tiles.evaluateAll(els => {
    const rects = els.map(el => el.getBoundingClientRect()).filter(r => r.width > 0);
    const top = Math.min(...rects.map(r => r.top));
    return rects.filter(r => Math.abs(r.top - top) < 2).length;
  });
  expect(columns).toBeLessThanOrEqual(2);
  expect(columns).toBeGreaterThan(0);
  mode = "contact-sheet";
  await page.reload({ waitUntil: "networkidle" });
  await expect(tiles.first()).toBeVisible();
  const image = tiles.first().locator("img").last();
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("Framed viewer leaves visible space and closes normally", async ({ page, api }) => {
  const settings = await (await api.get("/api/settings")).json();
  await page.route("**/api/settings**", r => r.fulfill({ json: { ...settings, siteDesign: "book", viewerMat: "framed" } }));
  await page.goto("/gallery", { waitUntil: "networkidle" });
  await page.locator("[data-photo-tile]").first().click();
  const dialog = page.locator('dialog[aria-label="写真ビューア"]');
  await expect(dialog).toBeVisible();
  const fit = dialog.locator('img[style*="88vw"]');
  await expect(fit).toBeVisible();
  const measure = await fit.evaluate(el => ({ height: el.getBoundingClientRect().height, viewport: innerHeight, fit: getComputedStyle(el).objectFit }));
  expect(measure.height).toBeLessThanOrEqual(measure.viewport * 0.77);
  expect(measure.height).toBeGreaterThan(0);
  expect(measure.fit).toBe("contain");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
