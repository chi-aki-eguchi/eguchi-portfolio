import { test, expect } from "./fixtures.ts";

test("Current admin screenshots load and preview tabs switch without overflow", async ({ page, api }) => {
  const settings = await (await api.get("/api/settings")).json();
  await page.route("**/api/settings**", route => route.fulfill({ json: { ...settings, siteUrl: "https://akieguchi.com", servicePageMode: "on" } }));
  await page.goto("/portfolio-kit#admin-video", { waitUntil: "networkidle" });
  const preview = page.locator("#admin-video");
  for (const [label, id] of [["写真を入れ替える", "library"], ["見せ方を変える", "settings"], ["文章を更新する", "profile"]]) {
    await preview.getByRole("button", { name: new RegExp(label) }).click();
    const image = preview.locator("img");
    await expect(image).toHaveAttribute("src", `/portfolio-kit/admin-20260929-${id}.jpg`);
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
