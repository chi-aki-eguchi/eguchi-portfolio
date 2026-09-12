import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoAdminTab } from "./helpers";

test("写真の構図を保つ行組み・サイズ変更・固定列・一覧復帰", async ({ page }) => {
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");
  const layout = page.getByRole("combobox", { name: "写真の並べ方" });
  await expect(layout).toHaveValue("contact");
  const cell = page.locator(".admin-contact-cell").first();
  await expect(cell).toBeVisible();
  const size = page.getByRole("slider", { name: "一覧の写真サイズ" });
  await size.fill("200");
  await expect.poll(async () => (await cell.boundingBox())!.height).toBeGreaterThan(100);
  const before = (await cell.boundingBox())!;
  await size.fill("60");
  await expect.poll(async () => (await cell.boundingBox())!.height).toBeLessThan(before.height);
  // 密度を変えても justified 行組みは維持: 最上段のセル幅の合計＋隙間が枠幅に一致する。
  const fit = await page.locator(".admin-contact-cell").evaluateAll(cells => {
    const rows = new Map<number, DOMRect[]>();
    for (const c of cells) { const r = c.getBoundingClientRect(); const k = Math.round(r.top); (rows.get(k) ?? rows.set(k, []).get(k)!).push(r); }
    const first = [...rows.entries()].sort((a, b) => a[0] - b[0])[0][1];
    const container = (cells[0].parentElement as HTMLElement).getBoundingClientRect().width;
    const sum = first.reduce((n, r) => n + r.width, 0) + (first.length - 1) * 3;
    return { container, sum };
  });
  expect(Math.abs(fit.container - fit.sum)).toBeLessThan(2);
  await expect(cell.locator("img").first()).toHaveCSS("object-fit", "contain");
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
 const first=page.locator('.admin-contact-cell').first().locator('[data-library-photo-action]').first();
 await first.focus();
 const expected=await page.locator('.admin-contact-cell').evaluateAll(cells=>{
  const rows=new Map<number,Element[]>();
  for(const c of cells){const k=Math.round(c.getBoundingClientRect().top);(rows.get(k)??rows.set(k,[]).get(k)!).push(c);}
  const sorted=[...rows.entries()].sort((a,b)=>a[0]-b[0]).map(e=>e[1]);
  const current=sorted[0][0].getBoundingClientRect();const x=current.x+current.width/2;
  const next=sorted[1].map(c=>c.querySelector('[data-library-photo-action]')!).sort((a,b)=>{const aa=a.getBoundingClientRect(),bb=b.getBoundingClientRect();return Math.abs(aa.x+aa.width/2-x)-Math.abs(bb.x+bb.width/2-x)})[0]; return {id:next.closest('.admin-photo-tile')!.id,name:next.getAttribute('aria-label')};
 });
 await page.keyboard.press('ArrowDown');
 const target=page.locator(`[id="${expected.id}"] [data-library-photo-action]`);
 await expect(target).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.locator('[data-library-inspector]')).toBeVisible();
 await expect(page.locator('.admin-inspector-photo-name')).toContainText(expected.name!);
});

test('サイズ・列数を連続で動かしても、見ていた写真を見失わない', async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsAdmin(page);
  await gotoAdminTab(page, 'gallery');
  const scroll = page.locator('[data-library-scroll]');
  const layout = page.getByRole('combobox', { name: '写真の並べ方' });
  const size = page.getByRole('slider', { name: '一覧の写真サイズ' });
  await expect(size).toBeVisible();

  // id + viewport offset of the top-most partially visible tile.
  const topAnchor = () => scroll.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const tile = [...el.querySelectorAll<HTMLElement>('.admin-photo-tile')]
      .find((t) => t.getBoundingClientRect().bottom > top + 4);
    return tile ? { id: tile.closest('[id^="admin-photo-"]')!.id, rel: Math.round(tile.getBoundingClientRect().top - top) } : null;
  });
  // Where the ORIGINAL captured photo sits now — measuring by its id defeats any
  // "re-capture a different photo to look stationary" cheat.
  const anchorRel = (id: string) => scroll.evaluate((el, pid) => {
    const found = document.getElementById(pid);
    if (!found) return null;
    const top = el.getBoundingClientRect().top;
    const r = found.getBoundingClientRect();
    return { rel: Math.round(r.top - top), inView: r.bottom > top + 8 && r.top < top + el.clientHeight - 8, dom: true };
  }, id);
  const settleFrames = () => page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150)))));

  // Real pointer drag that starts on the thumb (from the current value), like a
  // hand grabbing the handle — not a jump-to-track click.
  const thumbDrag = async (dir: 1 | -1, steps: number) => {
    const bb = (await size.boundingBox())!;
    const { value, min, max } = await size.evaluate((el: HTMLInputElement) => ({ value: +el.value, min: +el.min, max: +el.max }));
    const y = bb.y + bb.height / 2;
    const x0 = bb.x + Math.max(6, Math.min(bb.width - 6, bb.width * ((value - min) / (max - min))));
    await page.mouse.move(x0, y);
    await page.mouse.down();
    const span = bb.width * 0.36 * dir;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x0 + (span * i) / steps, y);
      await page.waitForTimeout(55);
    }
    await page.mouse.up();
    await settleFrames();
  };

  const grow = async (label: string, run: () => Promise<void>) => {
    let start: Awaited<ReturnType<typeof topAnchor>> = null;
    await expect.poll(async () => { start = await topAnchor(); return start?.id ?? null; }, { message: `${label}: no anchor tile`, timeout: 8000 }).toBeTruthy();
    await run();
    const end = await anchorRel(start!.id);
    expect(end, `${label}: anchor photo left the DOM entirely`).not.toBeNull();
    expect(end!.inView, `${label}: the photo you were on scrolled off screen (rel ${end!.rel})`).toBe(true);
    return { start, end: end! };
  };

  await scroll.evaluate((el) => { el.scrollTop = Math.round(el.scrollHeight * 0.45); });
  await page.waitForTimeout(200);

  // 1. Fast grow drag from the thumb.
  await grow('thumb drag / grow', () => thumbDrag(1, 10));
  // 2. Fast shrink drag from the thumb.
  await grow('thumb drag / shrink', () => thumbDrag(-1, 8));

  // 3. Track click (jump) then a short drag — the jarring case.
  await scroll.evaluate((el) => { el.scrollTop = Math.round(el.scrollHeight * 0.3); });
  await page.waitForTimeout(200);
  await grow('track click + drag', async () => {
    const bb = (await size.boundingBox())!;
    const y = bb.y + bb.height / 2;
    await page.mouse.move(bb.x + bb.width * 0.55, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) { await page.mouse.move(bb.x + bb.width * (0.55 + 0.06 * i), y); await page.waitForTimeout(50); }
    await page.mouse.up();
    await settleFrames();
  });

  // 4. Release, move the list, next gesture must anchor to the NEW top photo.
  await scroll.evaluate((el) => { el.scrollTop = Math.round(el.scrollHeight * 0.15); });
  await page.waitForTimeout(200);
  await grow('re-anchor after moving the list', () => thumbDrag(1, 6));

  // 5. Rows → grid layout switch keeps the photo visible, and so does the
  // follow-up column change from a new scroll position.
  await scroll.evaluate((el) => { el.scrollTop = Math.round(el.scrollHeight * 0.3); });
  await page.waitForTimeout(200);
  await grow('layout switch rows→grid', async () => {
    await layout.selectOption('grid');
    await settleFrames();
  });
  const cols = page.getByRole('combobox', { name: '一覧の列数' });
  await expect(cols).toBeVisible();
  await scroll.evaluate((el) => { el.scrollTop = Math.round(el.scrollHeight * 0.35); });
  await page.waitForTimeout(200);
  await grow('grid column change', async () => {
    const next = (await cols.evaluate((el: HTMLSelectElement) => el.selectedIndex)) + 1;
    await cols.selectOption({ index: next }).catch(() => cols.selectOption({ index: 0 }));
    await settleFrames();
  });
  await layout.selectOption('contact');
  await expect(size).toBeVisible();

  // 6. Keyboard repeat, then Tab out of the control (a real blur that does NOT
  // open a photo). The editor must not have opened and the photo must still show.
  await scroll.evaluate((el) => { el.scrollTop = Math.round(el.scrollHeight * 0.35); });
  await page.waitForTimeout(200);
  const kb = await grow('keyboard repeat then Tab-blur', async () => {
    await size.focus();
    for (let i = 0; i < 10; i++) { await size.press('ArrowRight'); await page.waitForTimeout(45); }
    await size.press('Tab');
    await settleFrames();
  });
  await expect(page.locator('[data-library-inspector]')).toHaveCount(0);
  expect(Math.abs(kb.end.rel - kb.start.rel), `keyboard: drifted ${kb.end.rel - kb.start.rel}px`).toBeLessThan(200);

  // 7. Keep focus on the slider, hand-scroll the list, then a new key gesture
  // must anchor to the photo that is on screen NOW — not the earlier one.
  await size.focus();
  await size.press('ArrowLeft');
  await page.waitForTimeout(120);
  await scroll.evaluate((el) => { el.scrollTop = el.scrollTop + Math.round(el.clientHeight * 1.4); });
  await page.waitForTimeout(200);
  const moved = (await topAnchor())!;
  await size.press('ArrowRight');
  await size.press('ArrowRight');
  await size.press('Tab');
  await settleFrames();
  const movedEnd = await anchorRel(moved.id);
  expect(movedEnd, 'stale-anchor guard: no tile after hand-scroll + key').not.toBeNull();
  expect(movedEnd!.inView, `stale-anchor guard: the photo on screen at the new key gesture scrolled away (rel ${movedEnd!.rel})`).toBe(true);
});

test('サイズ変更の直後にタブを離れても、次にLibraryへ戻ったとき最後の値が残る', async ({ page }, testInfo) => {
  // 密度スライダーは 1フレーム1回の下書き＋180msアイドルで確定する（連続ドラッグの
  // カクつき対策）。確定タイマーは AdminPageContent 側の state を持つため、通常の
  // タブ切替（同コンポーネント内でどのタブの中身を出すかを切り替えるだけ）では
  // 効いたまま残るが、値が sessionStorage へ確実に届くこと自体は環境非依存の
  // 挙動なので、UIが違うタブ切替導線を持つ端末は増やさずPCだけで確認する。
  testInfo.skip(testInfo.project.name !== 'desktop', 'サイドバーでのタブ切替はPC導線のみ確認する');
  await loginAsAdmin(page);
  await gotoAdminTab(page, 'gallery');
  const size = page.getByRole('slider', { name: '一覧の写真サイズ' });
  await expect(size).toBeVisible();
  const before = await size.inputValue();
  const target = before === '250' ? '90' : '250';
  await size.fill(target);
  // 確定(180ms)を待たず、すぐ実クリックで別タブへ離れる。
  await page.locator('.studio-workspace-switch').getByRole('button', { name: 'サイト編集', exact: true }).click();
  await expect(page.locator('[data-library-scroll]')).toHaveCount(0);
  await page.locator('.studio-workspace-switch').getByRole('button', { name: '写真', exact: true }).click();
  await expect(page.getByRole('slider', { name: '一覧の写真サイズ' })).toHaveValue(target);
});
