import { test, expect } from "./fixtures.ts";
import { SITE_DESIGNS } from "./site-design.ts";
import { loginAsAdmin, gotoAdminTab } from "./helpers";

// Real decoded image dimensions versus the displayed box. No production writes.
for (const design of SITE_DESIGNS) {
  for (const layout of ["side", "stack"]) {
    test(`About keeps original photo proportions: ${design}/${layout}`, async ({ page, api }) => {
      const base = await (await api.get("/api/settings")).json();
      let shape = [1200, 800];
      let photo = "/api/images/profile/aspect.svg";
      await page.route("**/api/settings**", route => route.fulfill({
        json: { ...base, siteDesign: design, profileLayout: layout, profilePhotoUrl: photo, noteEnabled: "off", profileName: "Aspect test", profileBio: "Profile biography", profileBioEn: "Profile biography" },
      }));
      await page.route("**/api/images/profile/aspect.svg**", route => route.fulfill({
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${shape[0]}" height="${shape[1]}"><rect width="100%" height="100%" fill="#718085"/><rect x="2" y="2" width="${shape[0] - 4}" height="${shape[1] - 4}" fill="none" stroke="white" stroke-width="4"/></svg>`,
      }));
      for (const [index, size] of [[1200, 800], [800, 1200], [900, 900], [1500, 500], [500, 1500]].entries()) {
        shape = size;
        await page.goto(index % 2 ? "/en/about" : "/about", { waitUntil: "networkidle" });
        const img = page.locator("[data-profile-layout] img");
        await expect(img).toBeVisible();
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
        const measure = await img.evaluate((el: HTMLImageElement) => {
          const rect = el.getBoundingClientRect();
          const text = el.closest("[data-profile-layout]")!.querySelector("h2")!.getBoundingClientRect();
          return { ratio: rect.width / rect.height, natural: el.naturalWidth / el.naturalHeight, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, right: rect.right, textBelowOrBeside: text.top >= rect.bottom - 1 || text.left >= rect.right, overflow: document.documentElement.scrollWidth - innerWidth };
        });
        expect(Math.abs(measure.ratio / measure.natural - 1)).toBeLessThan(0.01);
        // WebKit reports integer, density-corrected intrinsic sizes for srcset.
        // Allow the rounding of one pixel on each axis, not a different crop.
        expect(Math.abs(measure.naturalWidth - measure.naturalHeight * size[0] / size[1])).toBeLessThanOrEqual(1 + size[0] / size[1]);
        expect(measure.textBelowOrBeside).toBe(true);
        expect(measure.overflow).toBeLessThanOrEqual(1);
      }
      photo = "";
      await page.goto("/about", { waitUntil: "networkidle" });
      await expect(page.locator('[data-profile-layout="quiet"]')).toBeVisible();
      await expect(page.locator("[data-profile-layout] img")).toHaveCount(0);
      photo = "/api/images/profile/broken.svg";
      await page.route("**/api/images/profile/broken.svg**", route => route.fulfill({ status: 404, body: "missing" }));
      await page.goto("/about", { waitUntil: "networkidle" });
      await expect(page.locator('[data-profile-layout="quiet"]')).toBeVisible();
      await expect(page.getByRole("heading", { name: "Aspect test", exact: true })).toBeVisible();
    });
  }
}

test("Admin profile shows the same uncropped photo at narrow widths", async ({ page, api }) => {
  const settings = await (await api.get("/api/settings")).json();
  await page.route("**/api/settings**", route => route.fulfill({ json: { ...settings, profilePhotoUrl: "/api/images/profile/wide.svg" } }));
  await page.route("**/api/images/profile/wide.svg**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="900" height="300" fill="#718085"/></svg>' }));
  await loginAsAdmin(page);
  await gotoAdminTab(page, "profile");
  // About の写真は 2026-09-30 からサイトの画面の「About の文章と写真」で直す。
  const img = page.getByRole("img", { name: "プロフィール写真", exact: true });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  for (const width of [768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => img.evaluate(el => {
      const r = el.getBoundingClientRect();
      const c = getComputedStyle(el);
      return (r.width - parseFloat(c.borderLeftWidth) - parseFloat(c.borderRightWidth)) /
        (r.height - parseFloat(c.borderTopWidth) - parseFloat(c.borderBottomWidth));
    })).toBeCloseTo(3, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("Local owner demo works, but a customer site cannot enable it", async ({ page, api }) => {
  const base = await (await api.get("/api/settings")).json();
  let siteUrl = "https://akieguchi.com";
  await page.route("**/api/settings**", route => route.fulfill({ json: { ...base, siteUrl, servicePageMode: "on" } }));
  await page.goto("/admin/demo", { waitUntil: "networkidle" });
  await expect(page.locator("[data-admin-demo-guide]")).toBeVisible();
  await page.locator("[data-admin-demo-guide-start]").click();
  await expect(page.locator("[data-admin-demo-guide]")).toHaveCount(0);
  await expect(page.locator("[data-admin-demo-banner]")).toBeVisible();
  await expect(page.locator(".admin-book")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "管理画面の入口", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "管理画面の入口", exact: true }).getByRole("button", { name: "シリーズ", exact: true }).click();
  await expect(page.locator(".admin-book")).toHaveAttribute("data-view", "series");
  await page.getByRole("navigation", { name: "管理画面の入口", exact: true }).getByRole("button", { name: "サイト", exact: true }).click();
  await expect(page.locator(".admin-book")).toHaveAttribute("data-view", "site");
  siteUrl = "https://customer.example";
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText("404 — Page not found", { exact: true })).toBeVisible();
  await expect(page.locator("[data-admin-demo-banner]")).toHaveCount(0);
});
