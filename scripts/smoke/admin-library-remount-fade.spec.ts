import { test, expect } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

// WebKit applies opacity: 0 before a cached virtualized tile receives its
// loaded attribute, then runs the fade. Chromium batches both style changes,
// so this must run in the dedicated mobile Safari project.
test("admin — Safariで再マウントしたLibrary写真を透明にしない", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await gotoAdminTab(page, "gallery");

  const setup = await page.evaluate(async () => {
    const scrollElement = document.querySelector<HTMLElement>(
      "[data-library-scroll]",
    );
    const firstTile = document.querySelector<HTMLElement>(
      ".admin-photo-tile[id^=\"admin-photo-\"]",
    );
    if (!scrollElement || !firstTile) return null;

    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(".admin-photo-tile img"),
    );
    await new Promise<void>((resolve) => {
      const ready = () =>
        images.every((image) => image.complete && image.naturalWidth > 0);
      if (ready()) {
        resolve();
        return;
      }
      const timer = window.setInterval(() => {
        if (!ready()) return;
        window.clearInterval(timer);
        resolve();
      }, 16);
    });

    return {
      id: firstTile.id,
      canRemount: scrollElement.scrollHeight > scrollElement.clientHeight + 5,
    };
  });

  test.skip(!setup, "Libraryに検査できる写真がない");
  test.skip(!setup!.canRemount, "仮想スクロールを検査できる写真数がない");

  await page.locator("[data-library-scroll]").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.locator("[data-library-scroll]").evaluate((element) => {
    element.scrollTop = 0;
  });

  const firstImage = page.locator(`#${setup!.id} img`);
  await expect(firstImage).toBeAttached();
  const remountState = await firstImage.evaluate(async (image) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    return {
      complete: image.complete && image.naturalWidth > 0,
      opacity: Number(getComputedStyle(image).opacity),
    };
  });

  expect(remountState.complete).toBe(true);
  expect(remountState.opacity).toBe(1);
});
