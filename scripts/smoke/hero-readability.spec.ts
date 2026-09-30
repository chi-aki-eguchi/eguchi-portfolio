import { test, expect } from "./fixtures.ts";
import { loginAsAdmin, chooseSettingsSection } from "./helpers";
import { mkdirSync } from "node:fs";

// Real layout checks: chosen settings stay intact while small/short viewports
// fit the caption, and a transparent menu actually has the photograph behind it.
test("photo names fit phone, tablet, landscape and desktop, with a transparent menu", async ({ page, api }, info) => {
  test.skip(!["desktop", "mobile-safari"].includes(info.project.name));
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const saved = await (await api.get("/api/settings")).json();
  let settings = { ...saved };
  const photos = (await (await api.get("/api/photos")).json()).photos as { width: number; height: number; url: string }[];
  const landscape = photos.find(p => p.width > p.height)!;
  const portrait = photos.find(p => p.height > p.width)!;
  let heroPhoto = landscape;
  await page.route("**/api/hero-photos**", route => route.fulfill({ json: { heroPhotos: [heroPhoto] } }));
  await page.route("**/api/settings**", route => route.fulfill({ json: settings }));
  const sizes = [
    { width: 320, height: 667 }, { width: 390, height: 844 },
    { width: 768, height: 1024 }, { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const variant of [
      { heroMode: "single", heroDisplayMode: "normal", heroTitlePosition: "top-left", photoCrop: "cover", portrait: false },
      { heroMode: "single", heroDisplayMode: "fullscreen", heroTitlePosition: "bottom-right", photoCrop: "cover", portrait: true },
      { heroMode: "carousel", heroDisplayMode: "fullscreen", heroTitlePosition: "top-right", photoCrop: "cover", portrait: false },
      { heroMode: "single", heroDisplayMode: "normal", heroTitlePosition: "top-left", photoCrop: "whole", portrait: false },
      { heroMode: "single", heroDisplayMode: "fullscreen", heroTitlePosition: "bottom-right", photoCrop: "whole", portrait: true },
    ]) {
      const { portrait: usePortrait, ...heroSettings } = variant;
      heroPhoto = usePortrait ? portrait : landscape;
      settings = { ...saved, ...heroSettings, siteDesign: "classic", headerBackground: "none",
        siteName: "江口秋 写真作品", siteNameEn: "Aki Eguchi Photography Portfolio", heroSubtitle: "Photographs and selected works",
        heroNameSize: "160", heroNameEnSize: "80", heroSubSize: "60", heroNameColor: "#404040", heroNameEnColor: "#404040", heroSubColor: "#404040",
      };
      await page.goto("/");
      await expect(page.locator('[data-hero-name-part="primary"]')).toBeVisible();
      const metrics = await page.evaluate(() => {
        const caption = document.querySelector<HTMLElement>(".hero-single-caption")!;
        const stage = caption.parentElement!.getBoundingClientRect();
        const header = document.querySelector("header")!.getBoundingClientRect();
        const bounds = Array.from(caption.children).map(el => el.getBoundingClientRect());
        const main = document.querySelector("main")!.getBoundingClientRect();
        const ink = getComputedStyle(caption.querySelector("h1")!);
        return { mainTop: main.top, top: Math.min(...bounds.map(r => r.top)), bottom: Math.max(...bounds.map(r => r.bottom)),
          stageTop: stage.top, stageBottom: stage.bottom, headerBottom: header.bottom,
          overflow: document.documentElement.scrollWidth - innerWidth, horizontalOverflow: caption.scrollWidth - caption.clientWidth,
          ink: ink.color, shadow: ink.textShadow,
        };
      });
      expect(metrics.mainTop).toBeLessThanOrEqual(1);
      expect(metrics.top).toBeGreaterThanOrEqual(metrics.headerBottom - 1);
      expect(metrics.bottom).toBeLessThanOrEqual(metrics.stageBottom + 1);
      expect(metrics.overflow).toBeLessThanOrEqual(1);
      expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(metrics.ink).toBe("rgb(64, 64, 64)");
      expect(metrics.shadow.split("rgba").length).toBeGreaterThanOrEqual(4);
    }
  }
});

test("photo ink stays consistent when page theme changes; normal carousel keeps its name on paper", async ({ page, api }, info) => {
  test.skip(!["desktop", "mobile-safari"].includes(info.project.name));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const saved = await (await api.get("/api/settings")).json();
  let settings = { ...saved, heroMode: "single", heroDisplayMode: "fullscreen", heroNameColor: "#404040", heroNameEnColor: "#404040", heroSubColor: "#404040", themeBg: "#121212", themeBgDark: "#121212" };
  await page.route("**/api/settings**", route => route.fulfill({ json: settings }));
  await page.goto("/");
  const name = page.locator('[data-hero-name-part="primary"]');
  await expect(name).toHaveCSS("color", "rgb(64, 64, 64)");
  const adapted = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--hero-name-color").trim());
  expect(adapted).not.toBe("#404040");
  settings = { ...settings, heroMode: "carousel", heroDisplayMode: "normal" };
  await page.reload();
  await expect(name).toHaveAttribute("data-hero-name-tone", "on-paper");
  await expect(name).not.toHaveCSS("color", "rgb(64, 64, 64)");
});

test("transparent menu and collapsed name controls remain discoverable and previewable without saving", async ({ page, api }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const saved = await (await api.get("/api/settings")).json();
  await page.route("**/api/settings**", route => route.request().method() === "GET"
    ? route.fulfill({ json: { ...saved, setupCompleted: "true", heroMode: "single", heroDisplayMode: "normal", headerBackground: "solid" } })
    : route.fallback());
  await loginAsAdmin(page);
  await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
  await chooseSettingsSection(page, "name");
  await page.locator(".se-part-head__back").click();
  await page.locator(".se-search input").fill("透明");
  await page.locator('.se-parts [data-site-part="menu"]').click();
  await page.getByRole("button", { name: "写真に重ねる（文字のみ）", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Site Preview"]');
  await expect(frame.locator("header")).toHaveAttribute("data-header-bg", "none");
  await expect.poll(() => frame.locator(".hero-single").evaluate(el => el.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
  await chooseSettingsSection(page, "name");
  await page.locator("[data-fine-toggle]").click();
  await expect(page.locator('[data-settings-section="name"] input[type="number"]')).toHaveCount(5);
  await page.locator("[data-fine-toggle]").click();
  await expect(page.locator('[data-settings-section="name"] input[type="number"]')).toHaveCount(1);
  await expect(frame.locator("header")).toHaveAttribute("data-header-bg", "none");
  await expect.poll(() => frame.locator(".hero-single").evaluate(el => el.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
  await expect(frame.locator('[data-hero-name-part="primary"]')).toHaveCSS("opacity", "1");
  await page.getByText("大きさは上限です。", { exact: false }).scrollIntoViewIfNeeded();
  mkdirSync("scratch/settings-preservation-20261001", { recursive: true });
  await page.screenshot({ path: "scratch/settings-preservation-20261001/admin-name.png" });
});
