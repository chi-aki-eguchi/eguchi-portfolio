import { test, expect, type Page } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

type SwipeSample = {
  scrollTop: number;
  blankImages: number;
  exposedBlankImages: number;
  transparentBlankImages: number;
  transformedTiles: number;
  shadowedTiles: number;
  visibleTiles: number;
  revealedHoverStrips: number;
};

async function sampleLibrary(page: Page): Promise<SwipeSample> {
  return page.evaluate(() => {
    const scrollElement = document.querySelector<HTMLElement>(
      "[data-library-scroll]",
    );
    if (!scrollElement) {
      return {
        scrollTop: 0,
        blankImages: 0,
        exposedBlankImages: 0,
        transparentBlankImages: 0,
        transformedTiles: 0,
        shadowedTiles: 0,
        visibleTiles: 0,
        revealedHoverStrips: 0,
      };
    }

    const viewport = scrollElement.getBoundingClientRect();
    const visibleTiles = Array.from(
      document.querySelectorAll<HTMLElement>(".admin-photo-tile"),
    ).filter((tile) => {
      const rect = tile.getBoundingClientRect();
      return rect.bottom > viewport.top && rect.top < viewport.bottom;
    });
    const blankImages = visibleTiles
      .map((tile) => tile.querySelector<HTMLImageElement>("img"))
      .filter(
        (image): image is HTMLImageElement =>
          !!image && !(image.complete && image.naturalWidth > 0),
      );

    return {
      scrollTop: scrollElement.scrollTop,
      blankImages: blankImages.length,
      exposedBlankImages: blankImages.filter(
        (image) => Number(getComputedStyle(image).opacity) > 0.01,
      ).length,
      transparentBlankImages: blankImages.filter((image) => {
        const background = getComputedStyle(image).backgroundColor;
        return background === "transparent" || background.endsWith(", 0)");
      }).length,
      transformedTiles: visibleTiles.filter(
        (tile) => getComputedStyle(tile).transform !== "none",
      ).length,
      shadowedTiles: visibleTiles.filter(
        (tile) => getComputedStyle(tile).boxShadow !== "none",
      ).length,
      visibleTiles: visibleTiles.length,
      revealedHoverStrips: visibleTiles.filter((tile) =>
        Array.from(
          tile.querySelectorAll<HTMLElement>(".admin-photo-hover-only"),
        ).some((strip) => Number(getComputedStyle(strip).opacity) > 0.01),
      ).length,
    };
  });
}

async function waitForMountedThumbnails(page: Page) {
  await page.waitForFunction(() =>
    Array.from(
      document.querySelectorAll<HTMLImageElement>(".admin-photo-tile img"),
    ).every((image) => image.complete && image.naturalWidth > 0),
  );
}

// 回帰(2026-07-14): Libraryを高速スクロールしている間の白抜け、
// hover/press演出、仮想グリッドの逆方向ジャンプを同時に監視する。
test.describe("admin — Library高速スワイプの表示安定性", () => {
  test.describe("タッチ端末相当", () => {
    test.use({ hasTouch: true });

    test("スワイプ中に白抜け・拡大縮小・影の点滅が起きない", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile",
        "タッチ端末相当のmobileプロジェクトのみで検証",
      );

      await loginAsAdmin(page);
      await gotoAdminTab(page, "gallery");

      const setup = await page.evaluate(() => {
        const scrollElement = document.querySelector<HTMLElement>(
          "[data-library-scroll]",
        );
        if (!scrollElement) return null;
        const scrollRect = scrollElement.getBoundingClientRect();
        const tile = Array.from(
          document.querySelectorAll<HTMLElement>(".admin-photo-tile"),
        ).find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          return (
            centerY > Math.max(scrollRect.top + 80, 260) &&
            centerY < Math.min(scrollRect.bottom - 80, window.innerHeight - 80)
          );
        });
        if (!tile) return null;
        const tileRect = tile.getBoundingClientRect();
        return {
          x: tileRect.left + tileRect.width / 2,
          swipeTop: Math.max(scrollRect.top + 90, 180),
          swipeBottom: Math.min(
            scrollRect.bottom - 90,
            window.innerHeight - 90,
          ),
          scrollTop: scrollElement.scrollTop,
          scrollHeight: scrollElement.scrollHeight,
          clientHeight: scrollElement.clientHeight,
        };
      });

      test.skip(!setup, "Libraryに高速スワイプを測れるだけの写真がない");
      expect(setup!.scrollHeight).toBeGreaterThan(setup!.clientHeight + 5);
      await expect
        .poll(() =>
          page.locator("[data-library-scroll]").evaluate((element) =>
            getComputedStyle(element).overflowAnchor,
          ),
        )
        .toBe("none");
      await waitForMountedThumbnails(page);

      const session = await page.context().newCDPSession(page);
      const samples: SwipeSample[] = [];
      const performSwipe = async (direction: "forward" | "back") => {
        const startY =
          direction === "forward" ? setup!.swipeBottom : setup!.swipeTop;
        const endY =
          direction === "forward" ? setup!.swipeTop : setup!.swipeBottom;
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: setup!.x, y: startY }],
        });
        for (let step = 1; step <= 10; step += 1) {
          const y = startY + ((endY - startY) * step) / 10;
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: setup!.x, y }],
          });
          await page.waitForTimeout(16);
          samples.push(await sampleLibrary(page));
        }
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await page.waitForTimeout(24);
        samples.push(await sampleLibrary(page));
      };

      for (let pass = 0; pass < 6; pass += 1) await performSwipe("forward");
      const forwardSamples = [...samples];
      for (let pass = 0; pass < 6; pass += 1) await performSwipe("back");
      const backSamples = samples.slice(forwardSamples.length);
      await session.detach();

      expect(
        Math.max(...samples.map((sample) => sample.scrollTop)),
      ).toBeGreaterThan(setup!.scrollTop);
      expect(Math.max(...samples.map((sample) => sample.blankImages))).toBe(0);
      expect(
        Math.max(...samples.map((sample) => sample.exposedBlankImages)),
      ).toBe(0);
      expect(
        Math.max(...samples.map((sample) => sample.transparentBlankImages)),
      ).toBe(0);
      expect(Math.max(...samples.map((sample) => sample.transformedTiles))).toBe(
        0,
      );
      expect(Math.max(...samples.map((sample) => sample.shadowedTiles))).toBe(0);
      expect(
        Math.min(...samples.map((sample) => sample.visibleTiles)),
      ).toBeGreaterThan(0);
      expect(
        Math.max(...samples.map((sample) => sample.revealedHoverStrips)),
      ).toBe(0);

      const reverseJumps = (
        directionSamples: SwipeSample[],
        direction: "forward" | "back",
      ) =>
        directionSamples.slice(1).filter((sample, index) => {
          const previous = directionSamples[index];
          if (!previous) return false;
          const delta = sample.scrollTop - previous.scrollTop;
          return direction === "forward" ? delta < -1 : delta > 1;
        }).length;
      expect(reverseJumps(forwardSamples, "forward")).toBe(0);
      expect(reverseJumps(backSamples, "back")).toBe(0);
    });
  });

  test("デスクトップの高速スクロール中はhover演出を停止する", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "トラックパッド相当のdesktopプロジェクトのみで検証",
    );

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await waitForMountedThumbnails(page);

    const setup = await page.evaluate(() => {
      const scrollElement = document.querySelector<HTMLElement>(
        "[data-library-scroll]",
      );
      if (!scrollElement) return null;
      const viewport = scrollElement.getBoundingClientRect();
      const tile = Array.from(
        document.querySelectorAll<HTMLElement>(".admin-photo-tile"),
      ).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return (
          centerX > viewport.left + 80 &&
          centerX < viewport.right - 80 &&
          centerY > viewport.top + 120 &&
          centerY < viewport.bottom - 120
        );
      });
      if (!tile) return null;
      const rect = tile.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        scrollTop: scrollElement.scrollTop,
        scrollHeight: scrollElement.scrollHeight,
        clientHeight: scrollElement.clientHeight,
      };
    });
    test.skip(!setup, "Libraryに高速スクロールを測れるだけの写真がない");
    expect(setup!.scrollHeight).toBeGreaterThan(setup!.clientHeight + 5);

    await page.mouse.move(setup!.x, setup!.y);
    const samples: SwipeSample[] = [];
    for (let pass = 0; pass < 6; pass += 1) {
      await page.mouse.wheel(0, 720);
      await page.waitForTimeout(16);
      samples.push(await sampleLibrary(page));
    }
    for (let pass = 0; pass < 6; pass += 1) {
      await page.mouse.wheel(0, -720);
      await page.waitForTimeout(16);
      samples.push(await sampleLibrary(page));
    }

    expect(Math.max(...samples.map((sample) => sample.scrollTop))).toBeGreaterThan(
      setup!.scrollTop,
    );
    expect({
      maxExposedBlankImages: Math.max(
        ...samples.map((sample) => sample.exposedBlankImages),
      ),
      maxTransparentBlankImages: Math.max(
        ...samples.map((sample) => sample.transparentBlankImages),
      ),
      maxTransformedTiles: Math.max(
        ...samples.map((sample) => sample.transformedTiles),
      ),
      maxShadowedTiles: Math.max(
        ...samples.map((sample) => sample.shadowedTiles),
      ),
      minVisibleTiles: Math.min(
        ...samples.map((sample) => sample.visibleTiles),
      ),
      maxRevealedHoverStrips: Math.max(
        ...samples.map((sample) => sample.revealedHoverStrips),
      ),
    }).toEqual({
      maxExposedBlankImages: 0,
      maxTransparentBlankImages: 0,
      maxTransformedTiles: 0,
      maxShadowedTiles: 0,
      minVisibleTiles: expect.any(Number),
      maxRevealedHoverStrips: 0,
    });
  });
});
