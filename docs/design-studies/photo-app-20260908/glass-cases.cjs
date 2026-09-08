const { chromium, webkit, expect } = require('@playwright/test');
const BASE_URL = process.env.PHOTO_STUDY_URL || 'http://127.0.0.1:5082';

// Exercise the floating chrome against real scrolling and focus. No API writes.
(async () => {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(BASE_URL + '/#all');
      await expect(page.locator('.photo-tile')).toHaveCount(428);
      const fullyVisible = tile => tile.evaluate(element => {
        const r = element.getBoundingClientRect();
        const top = document.querySelector('#controls').getBoundingClientRect().bottom + 8;
        const bottom = innerWidth <= 700
          ? document.querySelector('.mobile-nav').getBoundingClientRect().top - 10
          : document.querySelector('#content').getBoundingClientRect().bottom;
        return r.top >= top - 1 && r.bottom <= bottom + 1;
      });

      // Same-task scroll/focus exposes a WebKit layout timing edge case.
      await page.locator('.photo-tile').nth(25).evaluate(tile => {
        const content = document.querySelector('#content');
        content.scrollTop += tile.getBoundingClientRect().top - 35;
        tile.focus();
      });
      await expect.poll(() => fullyVisible(page.locator('.photo-tile').nth(25))).toBe(true);
      await page.locator('.photo-tile').last().focus();
      await expect.poll(() => fullyVisible(page.locator('.photo-tile').last())).toBe(true);
      await page.locator('.photo-tile').first().focus();
      await expect.poll(() => fullyVisible(page.locator('.photo-tile').first())).toBe(true);

      await page.keyboard.press('Enter');
      await expect(page.locator('#viewer')).toBeVisible();
      await page.waitForTimeout(400);
      const before = await page.locator('#viewer-image').boundingBox();
      await page.locator('#info-toggle').click();
      expect(await page.locator('#viewer-image').boundingBox()).toEqual(before);
      await page.keyboard.press('Escape');
      await expect(page.locator('#info')).toBeHidden();
      await expect(page.locator('#viewer')).toBeVisible();
      await expect(page.locator('#info-toggle')).toBeFocused();
      // A late high-resolution response must never replace a newer photograph.
      await page.locator('#next').click();
      await page.locator('#next').click();
      await expect(page.locator('#viewer-count')).toHaveText('3 / 428');
      await expect.poll(() => page.evaluate(() => {
        const id = Number(new URLSearchParams(location.hash.split('?')[1]).get('photo'));
        const photo = window.PHOTO_STUDY_PHOTOS.find(p => p.id === id);
        const img = document.querySelector('#viewer-image');
        return img.complete && img.naturalWidth > 0 && new URL(img.src).pathname === (photo.mediumUrl || photo.url);
      }), { timeout: 15000 }).toBe(true);
      await expect(page.locator('.resolution-upgrade')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('#viewer')).toBeHidden();
      await expect(page.locator('.photo-tile').nth(2)).toBeFocused();
      await expect.poll(() => fullyVisible(page.locator('.photo-tile').nth(2))).toBe(true);

      const nav = page.locator(width <= 700 ? '.mobile-nav' : '.primary-nav');
      const indicator = await nav.locator('.nav-indicator').elementHandle();
      await nav.locator('[data-nav="series"]').click();
      expect(await indicator.evaluate(node => node.isConnected)).toBe(true);
      await page.waitForTimeout(400);
      const activeBox = await nav.locator('[aria-current="page"]').boundingBox();
      const indicatorBox = await indicator.boundingBox();
      expect(Math.abs(activeBox.x - indicatorBox.x)).toBeLessThan(1);
      expect(Math.abs(activeBox.y - indicatorBox.y)).toBeLessThan(1);

      await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' });
      await expect.poll(() => nav.locator('.nav-indicator').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
      await expect.poll(() => page.locator('.toolbar').evaluate(node => getComputedStyle(node).backdropFilter || getComputedStyle(node).webkitBackdropFilter)).toBe('none');
      expect(errors).toEqual([]);
      console.log(engine.name(), width, 'floating chrome, image, focus and preferences passed');
      await page.close();
    }
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
