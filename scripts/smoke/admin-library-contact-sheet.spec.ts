import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoAdminTab } from "./helpers";

test("写真の構図を保つ行組み・サイズ変更・固定列・一覧復帰", async ({ page }) => {
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  const layout = page.getByRole("combobox", { name: "写真の並べ方" });
  await expect(layout).toHaveValue("contact");
  const row = page.locator(".admin-contact-row").first();
  await expect(row).toBeVisible();
  const size = page.getByRole("slider", { name: "一覧の写真サイズ" });
  await size.fill("200");
  await expect.poll(async () => (await row.boundingBox())!.height).toBeGreaterThan(100);
  const before = (await row.boundingBox())!;
  await size.fill("60");
  await expect.poll(async () => (await row.boundingBox())!.height).toBeLessThan(before.height);
  const widths = await row.evaluate(el => ({ width: el.getBoundingClientRect().width, sum: [...el.children].reduce((n, child) => n + child.getBoundingClientRect().width, 0) + (el.children.length - 1) * 3 }));
  expect(Math.abs(widths.width - widths.sum)).toBeLessThan(1);
  await expect(row.locator("img").first()).toHaveCSS("object-fit", "contain");
  // Density changes keep the current group of photos near the viewport.
  const scroll = page.locator("[data-library-scroll]");
  await scroll.evaluate(el => { el.scrollTop = 1000; });
  let anchor: string | undefined;
  await expect.poll(async () => {
    anchor = await page.locator("[data-library-scroll] .admin-photo-tile").evaluateAll(tiles => tiles.find(tile => { const scroll = tile.closest("[data-library-scroll]"); if (!scroll) return false; return tile.getBoundingClientRect().bottom > scroll.getBoundingClientRect().top + 1; })?.id);
    return anchor;
  }).toBeTruthy();
  await size.fill("160");
  if (anchor) await expect(page.locator(`[id="${anchor}"]`)).toBeInViewport();
  await layout.selectOption("grid");
  const cols = page.getByRole("combobox", { name: "一覧の列数" });
  await cols.selectOption("4");
  await expect.poll(() => page.locator("[data-library-grid-mode] > .grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(4);
  await layout.selectOption("contact");
  await expect(size).toHaveValue("160");
  // Let ResizeObserver and the density anchor finish before a new scroll command.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => page.locator("[data-library-grid-mode]").getAttribute("data-rendered-count")).not.toBe("0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  // Scroll events update the virtual window on the next animation frame.
  await expect(page.locator(".admin-photo-tile").last()).toBeInViewport();
  const photoId = await page.locator(".admin-photo-tile").last().getAttribute("id");
  const photo = page.locator(`[id="${photoId}"] [data-library-photo-action]`);
  await photo.click();
  await expect(page.locator("[data-library-inspector]")).toBeVisible();
  await page.getByRole("button", { name: "写真の詳細を閉じる" }).click();
  await expect(photo).toBeFocused();
  await expect(photo).toBeInViewport();
  await page.reload();
  await expect(layout).toHaveValue("contact");
  await expect(size).toHaveValue("160");
});

test('上下キーで隣の行の写真へ移動し、Enterで同じ写真を開く',async({page})=>{
 await loginAsAdmin(page);await gotoAdminTab(page,'gallery');
 const first=page.locator('.admin-contact-row').first().locator('[data-library-photo-action]').first();
 await first.focus();
 const expected=await page.locator('.admin-contact-row').evaluateAll(rows=>{
  const current=rows[0].children[0].getBoundingClientRect();const x=current.x+current.width/2;
  const next=[...rows[1].querySelectorAll('[data-library-photo-action]')].sort((a,b)=>{const aa=a.getBoundingClientRect(),bb=b.getBoundingClientRect();return Math.abs(aa.x+aa.width/2-x)-Math.abs(bb.x+bb.width/2-x)})[0]; return {id:next.closest('.admin-photo-tile')!.id,name:next.getAttribute('aria-label')};
 });
 await page.keyboard.press('ArrowDown');
 const target=page.locator(`[id="${expected.id}"] [data-library-photo-action]`);
 await expect(target).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.locator('[data-library-inspector]')).toBeVisible();
 await expect(page.locator('.admin-inspector-photo-name')).toContainText(expected.name!);
});
